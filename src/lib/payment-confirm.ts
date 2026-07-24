import { createServiceClient } from "@/lib/supabase/service"

/**
 * Пост-обработка успешной оплаты (вызывается из эндпоинтов приёма после статуса paid):
 *  1) если платёж «помнит» абонемент (pending_membership_id) и подписки ещё нет —
 *     создаём активную подписку и привязываем к платежу;
 *  2) отправляем чек клиенту в Telegram (если привязан бот и telegram_id).
 * Идемпотентно и «мягко» — любые ошибки не роняют подтверждение оплаты.
 */
export async function afterPaymentPaid(clubId: string, paymentId: string): Promise<void> {
  try {
    const s = createServiceClient()
    const { data: pay } = await s.from("payments")
      .select("id, client_id, amount, subscription_id, pending_membership_id, pending_items")
      .eq("id", paymentId).eq("club_id", clubId).maybeSingle()
    if (!pay) return

    let membershipName: string | null = null
    let expiresAt: string | null = null

    // 0) Онлайн-продажа товаров: списываем остаток и пишем движения sale (только сейчас, после оплаты).
    //    Идемпотентно — после обработки очищаем pending_items.
    if (Array.isArray(pay.pending_items) && pay.pending_items.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const it of pay.pending_items as any[]) {
        await s.rpc("decrement_inventory", { p_product_id: it.product_id, p_qty: Number(it.qty), p_club_id: clubId })
        await s.from("stock_movements").insert({
          club_id: clubId, product_id: it.product_id, type: "sale",
          qty: Number(it.qty), unit_price: Number(it.unit_price ?? 0),
          client_id: pay.client_id ?? null, payment_id: paymentId,
        })
      }
      await s.from("payments").update({ pending_items: null }).eq("id", paymentId).eq("club_id", clubId)
    }

    // 1) Активировать абонемент атомарно и идемпотентно только после оплаты.
    const { data: confirmation, error: confirmationError } = await s.rpc("confirm_paid_membership", {
      p_club_id: clubId,
      p_payment_id: paymentId,
    })
    if (confirmationError) throw confirmationError
    const confirmed = confirmation as {
      membership_name?: string | null
      expires_at?: string | null
    } | null
    membershipName = confirmed?.membership_name ?? null
    expiresAt = confirmed?.expires_at ?? null

    // 2) Чек в Telegram.
    if (pay.client_id) await sendReceipt(clubId, pay.client_id, Number(pay.amount), membershipName, expiresAt)
  } catch { /* не роняем подтверждение оплаты */ }
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
