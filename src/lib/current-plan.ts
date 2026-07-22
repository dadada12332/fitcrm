import { getCurrentClub } from "@/lib/club"
import { getPlanByCode, type FullPlan } from "@/lib/plans"

/**
 * Актуальный тариф текущего клуба (фичи/лимиты/разделы) для CRM.
 * Конфигурация читается из БД и применяется в getCurrentClub(): права роли
 * пересекаются с разделами и функциями тарифа, а мутации проверяют лимиты.
 *
 * Вынесено в отдельный модуль (а не в lib/plans.ts), т.к. зависит от getCurrentClub →
 * next/headers, и не должно попадать в граф импортов лендинга/публичных модулей.
 */
export async function getCurrentPlan(): Promise<FullPlan | null> {
  const club = await getCurrentClub()
  if (!club) return null
  return getPlanByCode(club.plan)
}
