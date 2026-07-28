"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { logPlatformAction, requirePlatformPermission } from "@/lib/platform"

/** Подтвердить заявку: активировать тариф клуба на N месяцев. */
export async function approveBillingRequest(id: string): Promise<{ error?: string }> {
  const auth = await requirePlatformPermission("billing.manage")
  const service = createServiceClient()

  const { data, error } = await service.rpc("platform_approve_billing_request", {
    p_request_id: id,
    p_admin_id: auth.userId,
  })
  if (error) {
    if (error.message.includes("billing_request_not_found")) return { error: "Заявка не найдена" }
    if (error.message.includes("billing_request_already_processed") || error.message.includes("billing_request_race")) {
      return { error: "Заявка уже обработана" }
    }
    if (error.message.includes("billing_plan_not_found")) return { error: "Тариф заявки не найден или архивирован" }
    if (error.message.includes("billing_club_not_found")) return { error: "Клуб заявки не найден" }
    if (error.message.includes("promo_inactive")) return { error: "Промокод заявки уже отключён" }
    if (error.message.includes("promo_not_started")) return { error: "Период действия промокода ещё не начался" }
    if (error.message.includes("promo_expired")) return { error: "Срок действия промокода истёк" }
    if (error.message.includes("promo_exhausted")) return { error: "Лимит использований промокода исчерпан" }
    if (error.message.includes("promo_plan_mismatch")) return { error: "Промокод не действует для выбранного тарифа" }
    return { error: "Не удалось активировать подписку" }
  }

  const result = (data ?? {}) as { club_id?: string; plan?: string; months?: number; expires_at?: string | null }
  await logPlatformAction({
    action: "approve_billing",
    clubId: result.club_id ?? null,
    meta: { plan: result.plan, months: result.months, expiresAt: result.expires_at },
  })
  revalidatePath("/platform/subscriptions")
  return {}
}

export async function rejectBillingRequest(id: string): Promise<{ error?: string }> {
  const auth = await requirePlatformPermission("billing.manage")
  const service = createServiceClient()
  const { data: req } = await service.from("platform_billing_requests").select("club_id, status").eq("id", id).maybeSingle()
  if (!req || req.status !== "pending") return { error: "Заявка уже обработана" }
  const { data: updated, error } = await service.from("platform_billing_requests").update({
    status: "rejected", resolved_at: new Date().toISOString(), resolved_by: auth.userId,
  }).eq("id", id).eq("status", "pending").select("id").maybeSingle()
  if (error) return { error: "Не удалось отклонить заявку" }
  if (!updated) return { error: "Заявка уже обработана" }
  await logPlatformAction({ action: "reject_billing", clubId: req.club_id })
  revalidatePath("/platform/subscriptions")
  return {}
}
