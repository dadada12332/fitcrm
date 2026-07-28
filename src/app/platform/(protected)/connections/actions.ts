"use server"

import { revalidatePath } from "next/cache"
import { getPlatformAuth, logPlatformAction } from "@/lib/platform"
import { createServiceClient } from "@/lib/supabase/service"
import { encryptSecret, lastN } from "@/lib/crypto"
import type { Provider } from "@/lib/payments-connect"

type Result = { ok?: boolean; error?: string }

export type ClickCreds = { merchant_id: string; service_id: string; merchant_user_id: string; secret_key: string }
export type PaymeCreds = { cashbox_id: string; key: string; test_key: string; account_field: string }

function buildStored(provider: Provider, creds: ClickCreds | PaymeCreds): { secret: string; meta: Record<string, string> } {
  if (provider === "click") {
    const c = creds as ClickCreds
    return {
      secret: JSON.stringify({ merchant_id: c.merchant_id, service_id: c.service_id, merchant_user_id: c.merchant_user_id, secret_key: c.secret_key }),
      meta: { merchant_id: c.merchant_id, service_id: c.service_id, merchant_user_id: c.merchant_user_id, secret_last4: lastN(c.secret_key) },
    }
  }
  const c = creds as PaymeCreds
  return {
    secret: JSON.stringify({ cashbox_id: c.cashbox_id, key: c.key, test_key: c.test_key, account_field: c.account_field || "order_id" }),
    meta: { cashbox_id: c.cashbox_id, account_field: c.account_field || "order_id", key_last4: lastN(c.key) },
  }
}

async function verifyRequest(requestId: string, clubId: string, provider?: Provider, allowedStatuses: string[] = ["new"]) {
  const service = createServiceClient()
  const { data, error } = await service
    .from("payment_connection_requests")
    .select("id, club_id, provider, status")
    .eq("id", requestId)
    .eq("club_id", clubId)
    .maybeSingle()
  if (error) return { error: "Не удалось проверить заявку" }
  if (!data) return { error: "Заявка не найдена для выбранного клуба" }
  if (provider && data.provider !== provider) return { error: "Провайдер заявки не совпадает" }
  if (!allowedStatuses.includes(data.status)) return { error: "Заявка уже обработана" }
  return { request: data }
}

/** Активировать подключение: зашифровать креды, включить, перевести заявку в active. */
export async function activateConnectionAction(
  requestId: string, clubId: string, provider: Provider, creds: ClickCreds | PaymeCreds,
): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }

  // Минимальная валидация обязательных секретов.
  if (provider === "click") {
    const c = creds as ClickCreds
    if (!c.merchant_id || !c.service_id || !c.merchant_user_id || !c.secret_key) return { error: "Заполните все поля Click" }
  } else {
    const c = creds as PaymeCreds
    if (!c.cashbox_id || !c.key) return { error: "Заполните Cashbox ID и Key" }
  }

  const service = createServiceClient()
  const verified = await verifyRequest(requestId, clubId, provider)
  if ("error" in verified) return { error: verified.error }
  const { secret, meta } = buildStored(provider, creds)
  const secret_enc = encryptSecret(secret)

  const { error: e1 } = await service.from("club_payment_credentials").upsert({
    club_id: clubId, provider, enabled: true, secret_enc, meta, updated_by: auth.userId, updated_at: new Date().toISOString(),
  }, { onConflict: "club_id,provider" })
  if (e1) return { error: e1.message }

  const { data: resolved, error: e2 } = await service.from("payment_connection_requests")
    .update({ status: "active", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
    .eq("id", requestId)
    .eq("club_id", clubId)
    .eq("provider", provider)
    .eq("status", "new")
    .select("id")
    .maybeSingle()
  if (e2) return { error: e2.message }
  if (!resolved) {
    await service.from("club_payment_credentials")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("club_id", clubId)
      .eq("provider", provider)
    return { error: "Заявка уже обработана другим администратором" }
  }

  await logPlatformAction({ action: "payment_connect_activate", clubId, meta: { provider } })
  revalidatePath("/platform/connections")
  return { ok: true }
}

/** Отклонить заявку. */
export async function rejectConnectionAction(requestId: string, clubId: string): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  const verified = await verifyRequest(requestId, clubId)
  if ("error" in verified) return { error: verified.error }
  const { data: updated, error } = await service.from("payment_connection_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
    .eq("id", requestId)
    .eq("club_id", clubId)
    .eq("status", "new")
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }
  if (!updated) return { error: "Заявка уже обработана" }
  await logPlatformAction({ action: "payment_connect_reject", clubId })
  revalidatePath("/platform/connections")
  return { ok: true }
}

/** Отключить приём оплат (выключить креды + пометить заявку отменённой). */
export async function disableConnectionAction(requestId: string, clubId: string, provider: Provider): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  const verified = await verifyRequest(requestId, clubId, provider, ["active"])
  if ("error" in verified) return { error: verified.error }
  const { data: credential, error: credentialError } = await service.from("club_payment_credentials")
    .update({ enabled: false, updated_at: new Date().toISOString(), updated_by: auth.userId })
    .eq("club_id", clubId)
    .eq("provider", provider)
    .select("id")
    .maybeSingle()
  if (credentialError) return { error: credentialError.message }
  if (!credential) return { error: "Подключение не найдено" }
  const { data: updated, error: requestError } = await service.from("payment_connection_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
    .eq("id", requestId)
    .eq("club_id", clubId)
    .eq("provider", provider)
    .eq("status", "active")
    .select("id")
    .maybeSingle()
  if (requestError) return { error: requestError.message }
  if (!updated) return { error: "Заявка уже обработана" }
  await logPlatformAction({ action: "payment_connect_disable", clubId, meta: { provider } })
  revalidatePath("/platform/connections")
  return { ok: true }
}
