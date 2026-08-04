"use server"

import { sanitizeSearchTerm } from "@/lib/search"
import { revalidatePath } from "next/cache"
import { requirePlatformPermission } from "@/lib/platform"
import { createServiceClient } from "@/lib/supabase/service"

export type PlanPayload = {
  code: string
  name: string
  slug: string
  description: string
  short_description: string
  color: string
  icon: string
  sort_order: number
  is_popular: boolean
  is_recommended: boolean
  is_active: boolean
  is_trial: boolean
  trial_days: number
  price: number
  old_price: number | null
  discount_percent: number | null
  currency: string
  period: string
  landing_subtitle: string
  landing_benefits: string[]
  landing_cta: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  sections: Record<string, boolean>
}

type Result = { ok?: boolean; error?: string; id?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "boolean")
}

function isLimitRecord(value: unknown): value is Record<string, number | null> {
  return isRecord(value) && Object.values(value).every(
    (item) => item === null || (typeof item === "number" && Number.isFinite(item)),
  )
}

function isPlanPayload(value: unknown): value is PlanPayload {
  if (!isRecord(value)) return false
  const stringFields = [
    "code", "name", "slug", "description", "short_description", "color", "icon",
    "currency", "period", "landing_subtitle", "landing_cta",
  ] as const
  const numberFields = ["sort_order", "trial_days", "price"] as const
  const booleanFields = ["is_popular", "is_recommended", "is_active", "is_trial"] as const

  return stringFields.every((field) => typeof value[field] === "string")
    && numberFields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]))
    && booleanFields.every((field) => typeof value[field] === "boolean")
    && (value.old_price === null || (typeof value.old_price === "number" && Number.isFinite(value.old_price)))
    && (value.discount_percent === null || (typeof value.discount_percent === "number" && Number.isFinite(value.discount_percent)))
    && Array.isArray(value.landing_benefits)
    && value.landing_benefits.every((item) => typeof item === "string")
    && isBooleanRecord(value.features)
    && isLimitRecord(value.limits)
    && isBooleanRecord(value.sections)
}

async function revalidate() {
  revalidatePath("/platform/plans")
  revalidatePath("/platform/subscriptions")
  revalidatePath("/") // лендинг
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logChange(service: any, planId: string, admin: { userId: string; email: string }, action: string, field: string | null, oldVal: unknown, newVal: unknown) {
  await service.from("plan_change_logs").insert({
    plan_id: planId, admin_id: admin.userId, admin_email: admin.email,
    action, field,
    old_value: oldVal == null ? null : String(oldVal),
    new_value: newVal == null ? null : String(newVal),
  })
}

/** Создать пустой тариф (далее редактируется в drawer). */
export async function createPlanAction(): Promise<Result> {
  const auth = await requirePlatformPermission("plans.manage")
  const service = createServiceClient()

  // Уникальные code/slug.
  const suffix = Date.now().toString(36).slice(-4)
  const code = `plan_${suffix}`
  const { data: maxRow } = await service.from("plans").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle()
  const sort = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await service.from("plans").insert({
    code, name: "Новый тариф", slug: code, sort_order: sort, is_active: false,
  }).select("id").single()
  if (error) return { error: error.message }

  // Заполнить все ключи фич/лимитов/разделов (выключено / null), чтобы drawer показал полный список.
  const { FEATURE_KEYS, LIMIT_KEYS, SECTION_KEYS } = await import("@/lib/plans")
  await Promise.all([
    service.from("plan_features").insert(FEATURE_KEYS.map((k) => ({ plan_id: data.id, feature_key: k, enabled: false }))),
    service.from("plan_limits").insert(LIMIT_KEYS.map((k) => ({ plan_id: data.id, limit_key: k, limit_value: null }))),
    service.from("plan_sections").insert(SECTION_KEYS.map((k) => ({ plan_id: data.id, section_key: k, enabled: false }))),
  ])
  await logChange(service, data.id, auth, "create", null, null, "Новый тариф")
  await revalidate()
  return { ok: true, id: data.id }
}

/**
 * Полное сохранение тарифа (инфо + цена + лендинг + фичи + лимиты + разделы) с логом изменений.
 * priceApplyMode — что делать при изменении цены с уже подключёнными клубами:
 *   'new_only' — grandfather: существующие клубы сохраняют старую цену (фиксируем её за ними),
 *                новую цену платят только новые подключения;
 *   'all'      — все клубы этого тарифа переходят на новую цену (снимаем фиксацию).
 */
export async function savePlanAction(planId: string, p: PlanPayload, priceApplyMode?: "new_only" | "all"): Promise<Result> {
  const auth = await requirePlatformPermission("plans.manage")
  if (typeof planId !== "string" || !UUID_PATTERN.test(planId)) return { error: "Некорректный тариф" }
  if (priceApplyMode !== undefined && priceApplyMode !== "new_only" && priceApplyMode !== "all") {
    return { error: "Некорректный режим применения цены" }
  }
  if (!isPlanPayload(p)) return { error: "Некорректные данные тарифа" }
  if (!p.name.trim()) return { error: "Название обязательно" }
  if (!p.code.trim()) return { error: "Код тарифа обязателен" }
  if (!/^[a-z0-9][a-z0-9_-]{1,59}$/.test(p.code.trim())) return { error: "Код: 2–60 строчных латинских символов, цифр, _ или -" }
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(p.slug.trim())) return { error: "Slug: 2–80 строчных латинских символов, цифр, _ или -" }
  if (!Number.isFinite(p.price) || p.price < 0) return { error: "Цена не может быть отрицательной" }
  if (p.old_price !== null && (!Number.isFinite(p.old_price) || p.old_price < 0)) return { error: "Старая цена указана неверно" }
  if (p.discount_percent !== null && (!Number.isInteger(p.discount_percent) || p.discount_percent < 0 || p.discount_percent > 100)) return { error: "Скидка должна быть от 0 до 100%" }
  if (!Number.isInteger(p.trial_days) || p.trial_days < 0 || p.trial_days > 3650) return { error: "Срок Trial указан неверно" }
  if (!Number.isInteger(p.sort_order) || p.sort_order < -10_000 || p.sort_order > 100_000) return { error: "Порядок отображения указан неверно" }
  if (!/^[A-Z]{3}$/.test(p.currency.trim())) return { error: "Валюта должна быть трёхбуквенным кодом, например UZS" }
  if (Object.values(p.limits).some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0))) {
    return { error: "Лимиты должны быть целыми неотрицательными числами" }
  }
  if (p.is_trial !== (p.code.trim() === "trial")) return { error: "Trial — единственный системный пробный тариф" }
  if (!p.is_trial && p.is_active && p.period !== "monthly") {
    return { error: "Активные платные тарифы пока поддерживают только помесячный период" }
  }
  const service = createServiceClient()

  // Текущее состояние для диффа.
  const { data: cur } = await service.from("plans").select("*").eq("id", planId).single()
  if (!cur) return { error: "Тариф не найден" }
  if (cur.is_trial && (p.code.trim() !== cur.code || !p.is_trial)) {
    return { error: "Системный Trial нельзя переименовать или превратить в платный тариф" }
  }
  if (!cur.is_trial && (p.is_trial || p.code.trim() === "trial")) {
    return { error: "Нельзя создавать дополнительные Trial-тарифы" }
  }

  // Validate identity before any mutation. In particular, a duplicate code or
  // slug must not leave grandfather locks changed on an action that returns an
  // error.
  const { data: dup, error: duplicateError } = await service.from("plans")
    .select("id")
    .or(`code.eq.${sanitizeSearchTerm(p.code)},slug.eq.${sanitizeSearchTerm(p.slug)}`)
    .neq("id", planId)
  if (duplicateError) return { error: "Не удалось проверить код тарифа" }
  if (dup?.length) return { error: "Код или slug уже заняты" }

  // Commercial terms form one atomic grandfather snapshot. A locked numeric
  // price without its original currency/period can silently reprice renewals.
  const commercialTermsChanged = Number(cur.price) !== Number(p.price)
    || String(cur.currency) !== p.currency
    || String(cur.period) !== p.period
  if (commercialTermsChanged && !p.is_trial) {
    const { count: attachedClubCount, error: countError } = await service
      .from("clubs")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
    if (countError) return { error: "Не удалось проверить подключённые клубы" }
    if ((attachedClubCount ?? 0) > 0 && !priceApplyMode) {
      return { error: "Выберите, как применить новые коммерческие условия к действующим клубам" }
    }

  }

  const payload = {
    code: p.code.trim(), name: p.name.trim(), slug: p.slug.trim(),
    description: p.description, short_description: p.short_description,
    color: p.color, icon: p.icon, sort_order: p.sort_order,
    is_popular: p.is_popular, is_recommended: p.is_recommended, is_active: p.is_active,
    is_trial: p.is_trial, trial_days: p.trial_days,
    old_price: p.old_price, discount_percent: p.discount_percent,
    landing_subtitle: p.landing_subtitle, landing_benefits: p.landing_benefits, landing_cta: p.landing_cta,
    price: p.price, currency: p.currency.trim(), period: p.period,
  }
  // Read the current entitlement matrix only for the audit diff. The actual
  // definition + entitlements + logs are committed by one database RPC below.
  const [curFResult, curLResult, curSResult] = await Promise.all([
    service.from("plan_features").select("feature_key, enabled").eq("plan_id", planId),
    service.from("plan_limits").select("limit_key, limit_value").eq("plan_id", planId),
    service.from("plan_sections").select("section_key, enabled").eq("plan_id", planId),
  ])
  if (curFResult.error || curLResult.error || curSResult.error) return { error: "Не удалось прочитать текущие настройки тарифа" }
  const curF = curFResult.data
  const curL = curLResult.data
  const curS = curSResult.data

  const curFMap = new Map((curF ?? []).map((x: { feature_key: string; enabled: boolean }) => [x.feature_key, x.enabled]))
  const curLMap = new Map((curL ?? []).map((x: { limit_key: string; limit_value: number | null }) => [x.limit_key, x.limit_value]))
  const curSMap = new Map((curS ?? []).map((x: { section_key: string; enabled: boolean }) => [x.section_key, x.enabled]))

  // Собираем логи изменений в один массив (одна вставка вместо десятков).
  const logs: Record<string, unknown>[] = []
  const pushLog = (action: string, field: string, oldV: unknown, newV: unknown) =>
    logs.push({ plan_id: planId, admin_id: auth.userId, admin_email: auth.email, action, field, old_value: oldV == null ? null : String(oldV), new_value: newV == null ? null : String(newV) })

  const tracked: (keyof typeof payload)[] = ["name", "code", "price", "old_price", "discount_percent", "currency", "period", "is_active", "is_popular", "is_recommended", "is_trial", "trial_days"]
  for (const fld of tracked) {
    if (String(cur[fld] ?? "") !== String((payload as Record<string, unknown>)[fld] ?? "")) pushLog("update", fld as string, cur[fld], (payload as Record<string, unknown>)[fld])
  }
  for (const [k, v] of Object.entries(p.features)) if (curFMap.get(k) !== v) pushLog("features", `feature.${k}`, curFMap.get(k) ? "ON" : "OFF", v ? "ON" : "OFF")
  for (const [k, v] of Object.entries(p.limits)) if (String(curLMap.get(k) ?? "∞") !== String(v ?? "∞")) pushLog("limits", `limit.${k}`, curLMap.get(k) ?? "∞", v ?? "∞")
  for (const [k, v] of Object.entries(p.sections)) if (curSMap.get(k) !== v) pushLog("sections", `section.${k}`, curSMap.get(k) ? "ON" : "OFF", v ? "ON" : "OFF")

  if (commercialTermsChanged) {
    pushLog(
      "pricing_grandfather",
      "commercial_terms",
      `${cur.price} ${cur.currency}/${cur.period}`,
      `${p.price} ${p.currency}/${p.period}; ${priceApplyMode ?? "no_attached_clubs"}`,
    )
  }

  const { error: saveError } = await service.rpc("platform_save_plan_configuration", {
    p_plan_id: planId,
    p_payload: payload,
    p_features: p.features,
    p_limits: p.limits,
    p_sections: p.sections,
    p_logs: logs,
    p_apply_mode: priceApplyMode ?? null,
    p_admin_id: auth.userId,
    p_admin_email: auth.email,
  })
  if (saveError?.code === "23505") return { error: "Код или slug уже заняты" }
  if (saveError) return { error: "Не удалось атомарно сохранить тариф" }

  await revalidate()
  return { ok: true }
}

/** Архивировать / вернуть из архива. */
export async function archivePlanAction(planId: string, archived: boolean): Promise<Result> {
  const auth = await requirePlatformPermission("plans.manage")
  const service = createServiceClient()
  // Restoring returns a plan to draft; activation must pass the full atomic
  // save validation (period, Trial identity, limits and commercial terms).
  const { error } = await service.from("plans").update({ is_archived: archived, is_active: false, updated_at: new Date().toISOString() }).eq("id", planId)
  if (error) return { error: error.message }
  await logChange(service, planId, auth, "archive", "is_archived", !archived, archived)
  await revalidate()
  return { ok: true }
}

/** Дублировать тариф со всеми фичами/лимитами/разделами. */
export async function duplicatePlanAction(planId: string): Promise<Result> {
  const auth = await requirePlatformPermission("plans.manage")
  const service = createServiceClient()
  const { data: src } = await service.from("plans").select("*").eq("id", planId).single()
  if (!src) return { error: "Тариф не найден" }

  const suffix = Date.now().toString(36).slice(-4)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = src
  const { data: created, error } = await service.from("plans").insert({
    ...rest,
    code: `${src.code}_copy_${suffix}`.slice(0, 60),
    slug: `${src.slug}-copy-${suffix}`.slice(0, 60),
    name: `${src.name} (копия)`,
    is_active: false, is_popular: false, is_recommended: false, is_archived: false,
    is_trial: false, trial_days: 0,
    sort_order: (src.sort_order ?? 0) + 1,
  }).select("id").single()
  if (error) return { error: error.message }

  const [{ data: f }, { data: l }, { data: s }] = await Promise.all([
    service.from("plan_features").select("feature_key, enabled").eq("plan_id", planId),
    service.from("plan_limits").select("limit_key, limit_value").eq("plan_id", planId),
    service.from("plan_sections").select("section_key, enabled").eq("plan_id", planId),
  ])
  await Promise.all([
    (f ?? []).length ? service.from("plan_features").insert((f ?? []).map((x: { feature_key: string; enabled: boolean }) => ({ plan_id: created.id, feature_key: x.feature_key, enabled: x.enabled }))) : Promise.resolve(),
    (l ?? []).length ? service.from("plan_limits").insert((l ?? []).map((x: { limit_key: string; limit_value: number | null }) => ({ plan_id: created.id, limit_key: x.limit_key, limit_value: x.limit_value }))) : Promise.resolve(),
    (s ?? []).length ? service.from("plan_sections").insert((s ?? []).map((x: { section_key: string; enabled: boolean }) => ({ plan_id: created.id, section_key: x.section_key, enabled: x.enabled }))) : Promise.resolve(),
  ])
  await logChange(service, created.id, auth, "duplicate", null, src.name, `${src.name} (копия)`)
  await revalidate()
  return { ok: true, id: created.id }
}

export type PlanChangeLog = {
  id: number; action: string; field: string | null
  old_value: string | null; new_value: string | null
  admin_email: string | null; created_at: string
}

/** История изменений тарифа. */
export async function loadPlanHistoryAction(planId: string): Promise<PlanChangeLog[]> {
  await requirePlatformPermission("plans.manage")
  const service = createServiceClient()
  const { data } = await service.from("plan_change_logs")
    .select("id, action, field, old_value, new_value, admin_email, created_at")
    .eq("plan_id", planId).order("created_at", { ascending: false }).limit(100)
  return (data ?? []) as PlanChangeLog[]
}

/** Удалить тариф — только если им никто не пользуется. */
export async function deletePlanAction(planId: string): Promise<Result> {
  await requirePlatformPermission("plans.manage")
  const service = createServiceClient()
  const { count } = await service.from("clubs").select("id", { count: "exact", head: true }).eq("plan_id", planId)
  if ((count ?? 0) > 0) return { error: `Нельзя удалить: тариф используют ${count} клуб(ов). Архивируйте вместо удаления.` }
  const { error } = await service.from("plans").delete().eq("id", planId)
  if (error) return { error: error.message }
  await revalidate()
  return { ok: true }
}
