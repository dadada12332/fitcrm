import { getCurrentClub } from "@/lib/club"
import { getPlanByCode, type FullPlan } from "@/lib/plans"

/**
 * Актуальный тариф текущего клуба (фичи/лимиты/разделы) для CRM.
 * Данные из кеша (60 c) → изменения из Platform Admin применяются без деплоя.
 * Enforcement (скрытие разделов / блокировка при превышении лимитов) — отдельная фаза;
 * сейчас это только чтение конфигурации тарифа.
 *
 * Вынесено в отдельный модуль (а не в lib/plans.ts), т.к. зависит от getCurrentClub →
 * next/headers, и не должно попадать в граф импортов лендинга/публичных модулей.
 */
export async function getCurrentPlan(): Promise<FullPlan | null> {
  const club = await getCurrentClub()
  if (!club) return null
  return getPlanByCode(club.plan)
}
