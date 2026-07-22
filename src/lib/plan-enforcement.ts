import type { CurrentClub } from "@/lib/club"
import { planFeatureEnabled, planLimitError, planLimitValue, planSectionEnabled } from "@/lib/plan-access"
import type { FeatureKey, LimitKey, SectionKey } from "@/lib/plans"
import { createServiceClient } from "@/lib/supabase/service"

type Club = NonNullable<CurrentClub>

export function requirePlanFeature(club: Club, key: FeatureKey): string | null {
  return planFeatureEnabled(club.planAccess, key) ? null : "Функция недоступна на текущем тарифе"
}

export function requirePlanSection(club: Club, key: SectionKey): string | null {
  return planSectionEnabled(club.planAccess, key) ? null : "Раздел недоступен на текущем тарифе"
}

export function requireRecordLimit(club: Club, key: LimitKey, current: number, adding = 1): string | null {
  return planLimitError(club.planAccess, key, current, adding)
}

/** Атомарно резервирует месячный расход (AI, Telegram, импорт/экспорт). */
export async function consumeMonthlyLimit(club: Club, key: LimitKey, amount = 1): Promise<string | null> {
  const limit = planLimitValue(club.planAccess, key)
  if (limit === null) return null
  if (limit <= 0) return planLimitError(club.planAccess, key, limit, 1)
  const { data, error } = await createServiceClient().rpc("consume_plan_usage", {
    p_club_id: club.clubId,
    p_usage_key: key,
    p_amount: amount,
    p_limit: limit,
  })
  if (error) return "Не удалось проверить лимит тарифа"
  return data === true ? null : planLimitError(club.planAccess, key, limit, 1)
}

export async function requireIntegrationSlot(club: Club): Promise<string | null> {
  const service = createServiceClient()
  const [telegram, instagram, payments] = await Promise.all([
    service.from("telegram_integrations").select("club_id", { count: "exact", head: true }).eq("club_id", club.clubId),
    service.from("integration_connections").select("id", { count: "exact", head: true }).eq("club_id", club.clubId),
    service.from("payment_connection_requests").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).in("status", ["new", "active"]),
  ])
  return requireRecordLimit(club, "integrations", (telegram.count ?? 0) + (instagram.count ?? 0) + (payments.count ?? 0))
}
