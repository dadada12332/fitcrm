"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { logPlatformAction, requirePlatformPermission } from "@/lib/platform"

/** Подтвердить заявку: активировать тариф клуба на N месяцев. */
export async function approveBillingRequest(id: string): Promise<{ error?: string }> {
  if (typeof id !== "string" || !id) return { error: "Некорректная заявка" }
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
    if (error.message.includes("billing_club_deleted")) return { error: "Клуб удалён — активировать подписку нельзя" }
    if (error.message.includes("billing_request_invalid_months")) return { error: "В заявке некорректный срок. Попросите клуб отправить её заново" }
    if (error.message.includes("billing_request_unsupported_period")) return { error: "Период тарифа не поддерживается. Попросите клуб отправить заявку заново" }
    if (error.message.includes("billing_request_quote_missing") || error.message.includes("billing_request_quote_invalid")) {
      return { error: "Снимок цены заявки некорректен. Попросите клуб отправить её заново" }
    }
    if (error.message.includes("billing_request_promo_snapshot_invalid")) return { error: "Данные промокода в заявке некорректны" }
    if (error.message.includes("billing_request_compensation_snapshot_invalid")) return { error: "Данные компенсации в заявке некорректны" }
    if (error.message.includes("billing_unlimited_plan_no_renewal")) return { error: "Бессрочный тариф не требует продления" }
    if (error.message.includes("billing_plan_capacity_exceeded:")) {
      return { error: "Клуб превышает лимит выбранного тарифа. Сначала сократите использование или выберите тариф выше" }
    }
    if (error.message.includes("billing_plan_capacity_unconfigured:") || error.message.includes("billing_club_owner_not_found")) {
      return { error: "Не удалось проверить лимиты тарифа. Проверьте конфигурацию клуба и тарифа" }
    }
    if (error.message.includes("promo_inactive")) return { error: "Промокод заявки уже отключён" }
    if (error.message.includes("promo_not_started")) return { error: "Период действия промокода ещё не начался" }
    if (error.message.includes("promo_expired")) return { error: "Срок действия промокода истёк" }
    if (error.message.includes("promo_exhausted")) return { error: "Лимит использований промокода исчерпан" }
    if (error.message.includes("promo_plan_mismatch")) return { error: "Промокод не действует для выбранного тарифа" }
    if (error.message.includes("compensation_unavailable") || error.message.includes("compensation_race")) {
      return { error: "Компенсация уже недоступна. Попросите клуб отправить заявку заново" }
    }
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
