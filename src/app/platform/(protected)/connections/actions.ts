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
  const { secret, meta } = buildStored(provider, creds)
  const secret_enc = encryptSecret(secret)

  const { error: e1 } = await service.from("club_payment_credentials").upsert({
    club_id: clubId, provider, enabled: true, secret_enc, meta, updated_by: auth.userId, updated_at: new Date().toISOString(),
  }, { onConflict: "club_id,provider" })
  if (e1) return { error: e1.message }

  const { error: e2 } = await service.from("payment_connection_requests")
    .update({ status: "active", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
    .eq("id", requestId)
  if (e2) return { error: e2.message }

  await logPlatformAction({ action: "payment_connect_activate", clubId, meta: { provider } })
  revalidatePath("/platform/connections")
  return { ok: true }
}

/** Отклонить заявку. */
export async function rejectConnectionAction(requestId: string, clubId: string): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  const { error } = await service.from("payment_connection_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: auth.userId })
    .eq("id", requestId)
  if (error) return { error: error.message }
  await logPlatformAction({ action: "payment_connect_reject", clubId })
  revalidatePath("/platform/connections")
  return { ok: true }
}

/** Отключить приём оплат (выключить креды + пометить заявку отменённой). */
export async function disableConnectionAction(requestId: string, clubId: string, provider: Provider): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  await service.from("club_payment_credentials").update({ enabled: false, updated_at: new Date().toISOString() }).eq("club_id", clubId).eq("provider", provider)
  await service.from("payment_connection_requests").update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: auth.userId }).eq("id", requestId)
  await logPlatformAction({ action: "payment_connect_disable", clubId, meta: { provider } })
  revalidatePath("/platform/connections")
  return { ok: true }
}
