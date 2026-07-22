"use server"

import { getCurrentClub } from "@/lib/club"
import { isLimitKey, LIMIT_LABELS, type LimitKey } from "@/lib/plan-limits"
import { createServiceClient } from "@/lib/supabase/service"

export type PlanUpgradeOffer = {
  code: string
  name: string
  price: number
  oldPrice: number | null
  currency: string
  period: string
  limit: number | null
  benefits: string[]
}

const LIMIT_BENEFIT_MARKERS: Record<LimitKey, string[]> = {
  clients: ["клиент"],
  staff: ["сотруд", "тренер"],
  branches: ["филиал"],
  products: ["товар", "склад"],
  roles: ["рол", "прав"],
  integrations: ["интеграц"],
  ai_requests: ["ai", "ии", "аналит"],
  telegram_messages: ["telegram", "сообщен", "рассыл"],
  imports: ["импорт"],
  exports: ["экспорт"],
}

export async function getPlanUpgradeRecommendationAction(rawKey: string): Promise<{ offer?: PlanUpgradeOffer; error?: string }> {
  if (!isLimitKey(rawKey)) return { error: "Неизвестный лимит" }
  const key: LimitKey = rawKey
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  const currentLimit = club.planAccess?.limits[key]
  if (currentLimit === null || currentLimit === undefined) return { error: "Для текущего тарифа лимит не установлен" }

  const { data, error } = await createServiceClient().from("plans").select(`
    code, name, price, old_price, currency, period, sort_order, landing_benefits,
    plan_limits!inner(limit_key, limit_value)
  `).eq("is_active", true).eq("is_archived", false).eq("plan_limits.limit_key", key).order("sort_order")
  if (error) return { error: "Не удалось загрузить доступные тарифы" }

  const currentPlan = (data ?? []).find((plan) => plan.code === club.plan)
  const currentSortOrder = Number(currentPlan?.sort_order ?? -1)

  const candidates = (data ?? []).filter((plan) => {
    if (plan.code === club.plan) return false
    if (Number(plan.sort_order) <= currentSortOrder) return false
    const row = plan.plan_limits?.[0]
    return row && (row.limit_value === null || Number(row.limit_value) > currentLimit)
  })
  const next = candidates[0]
  if (!next) return {}
  const nextLimit = next.plan_limits?.[0]?.limit_value
  const benefits = Array.isArray(next.landing_benefits)
    ? next.landing_benefits.filter((item): item is string => {
      if (typeof item !== "string") return false
      const normalized = item.toLocaleLowerCase("ru-RU")
      return !LIMIT_BENEFIT_MARKERS[key].some((marker) => normalized.includes(marker))
    }).slice(0, 2)
    : []
  if (nextLimit !== undefined) {
    benefits.unshift(nextLimit === null
      ? `${LIMIT_LABELS[key]} без ограничений`
      : `${LIMIT_LABELS[key]}: до ${Number(nextLimit).toLocaleString("ru-RU")}`)
  }

  return {
    offer: {
      code: next.code,
      name: next.name,
      price: Number(next.price),
      oldPrice: next.old_price === null ? null : Number(next.old_price),
      currency: next.currency,
      period: next.period,
      limit: nextLimit === null ? null : Number(nextLimit),
      benefits: [...new Set(benefits)].slice(0, 3),
    },
  }
}
