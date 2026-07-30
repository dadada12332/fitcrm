import { createServiceClient } from "@/lib/supabase/service"

export type PaymentConfirmation = {
  payment_id?: string
  client_id?: string | null
  amount?: number | string | null
  membership_name?: string | null
  expires_at?: string | null
  newly_confirmed?: boolean
}

/**
 * The database RPC owns the whole confirmation transaction: paid state,
 * inventory, stock movements and membership activation. Throwing here is
 * intentional: provider callbacks must not acknowledge a payment before the
 * database commit succeeds.
 */
export async function confirmProviderPayment(
  clubId: string,
  paymentId: string,
  provider: "click" | "payme",
  transactionId: string,
  paidAt = new Date().toISOString(),
): Promise<PaymentConfirmation> {
  const service = createServiceClient()
  const { data, error } = await service.rpc("confirm_provider_payment", {
    p_club_id: clubId,
    p_payment_id: paymentId,
    p_provider: provider,
    p_tx_id: transactionId,
    p_paid_at: paidAt,
  })
  if (error) throw error
  return (data as PaymentConfirmation | null) ?? {}
}

/**
 * Compatibility entry point used by reconciliation. It resolves the already
 * recorded provider transaction and runs the same atomic RPC.
 */
export async function afterPaymentPaid(clubId: string, paymentId: string): Promise<PaymentConfirmation> {
  const service = createServiceClient()
  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("provider, tx_id, paid_at")
    .eq("id", paymentId)
    .eq("club_id", clubId)
    .maybeSingle()
  if (paymentError) throw paymentError
  if (!payment?.tx_id || (payment.provider !== "click" && payment.provider !== "payme")) {
    throw new Error("Provider transaction is missing")
  }
  return confirmProviderPayment(
    clubId,
    paymentId,
    payment.provider,
    payment.tx_id,
    payment.paid_at ?? new Date().toISOString(),
  )
}

export async function sendPaymentReceipt(
  clubId: string,
  confirmation: PaymentConfirmation,
): Promise<void> {
  if (!confirmation.newly_confirmed || !confirmation.client_id) return
  await sendReceipt(
    clubId,
    confirmation.client_id,
    Number(confirmation.amount ?? 0),
    confirmation.membership_name ?? null,
    confirmation.expires_at ?? null,
  )
}

async function sendReceipt(clubId: string, clientId: string, amount: number, membership: string | null, expires: string | null): Promise<void> {
  const s = createServiceClient()
  const [{ data: cl }, { data: integration }, { data: club }] = await Promise.all([
    s.from("clients").select("telegram_id").eq("id", clientId).eq("club_id", clubId).maybeSingle(),
    s.from("telegram_integrations").select("bot_token").eq("club_id", clubId).maybeSingle(),
    s.from("clubs").select("settings").eq("id", clubId).maybeSingle(),
  ])
  if (!cl?.telegram_id || !integration?.bot_token) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tpl = (club?.settings as any)?.tg_settings?.payment_template
    ?? "✅ Оплата подтверждена!\n\nСумма: {{amount}} сум\nАбонемент: {{membership}}\nДействует до: {{expires}}"
  const text = tpl
    .replace(/\{\{amount\}\}/g, amount.toLocaleString("ru-RU"))
    .replace(/\{\{membership\}\}/g, membership ?? "—")
    .replace(/\{\{expires\}\}/g, expires ? new Date(expires).toLocaleDateString("ru-RU") : "—")
  await fetch(`https://api.telegram.org/bot${integration.bot_token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: cl.telegram_id, text }),
  }).catch(() => {})
}
