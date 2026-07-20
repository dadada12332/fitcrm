"use server"

import { sanitizeSearchTerm } from "@/lib/search"
import { revalidatePath } from "next/cache"
import { getPlatformAuth } from "@/lib/platform"
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
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
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
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  if (!p.name.trim()) return { error: "Название обязательно" }
  if (!p.code.trim()) return { error: "Код тарифа обязателен" }
  const service = createServiceClient()

  // Текущее состояние для диффа.
  const { data: cur } = await service.from("plans").select("*").eq("id", planId).single()
  if (!cur) return { error: "Тариф не найден" }

  // Grandfather pricing: обработка изменения цены для уже подключённых клубов.
  const priceChanged = Number(cur.price) !== Number(p.price)
  if (priceChanged && !p.is_trial) {
    if (priceApplyMode === "new_only") {
      // Зафиксировать СТАРУЮ цену за клубами этого тарифа, у которых фиксации ещё нет.
      await service.from("clubs").update({ plan_price_locked: Number(cur.price) }).eq("plan_id", planId).is("plan_price_locked", null)
      await logChange(service, planId, auth, "pricing_grandfather", "price_apply", "new_only", `старая цена ${cur.price} закреплена за текущими клубами`)
    } else if (priceApplyMode === "all") {
      // Снять фиксацию — все клубы этого тарифа переходят на новую цену.
      await service.from("clubs").update({ plan_price_locked: null }).eq("plan_id", planId)
      await logChange(service, planId, auth, "pricing_grandfather", "price_apply", "all", `новая цена ${p.price} применена ко всем клубам`)
    }
  }

  // Проверка уникальности code/slug (кроме себя).
  const { data: dup } = await service.from("plans").select("id").or(`code.eq.${sanitizeSearchTerm(p.code)},slug.eq.${sanitizeSearchTerm(p.slug)}`).neq("id", planId)
  if (dup && dup.length) return { error: "Код или slug уже заняты" }

  const patch = {
    code: p.code.trim(), name: p.name.trim(), slug: p.slug.trim(),
    description: p.description, short_description: p.short_description,
    color: p.color, icon: p.icon, sort_order: p.sort_order,
    is_popular: p.is_popular, is_recommended: p.is_recommended, is_active: p.is_active,
    is_trial: p.is_trial, trial_days: p.trial_days,
    price: p.price, old_price: p.old_price, discount_percent: p.discount_percent,
    currency: p.currency, period: p.period,
    landing_subtitle: p.landing_subtitle, landing_benefits: p.landing_benefits, landing_cta: p.landing_cta,
    updated_at: new Date().toISOString(),
  }
  // Текущие фичи/лимиты/разделы (для диффа) — параллельно с update плана.
  const [{ error }, { data: curF }, { data: curL }, { data: curS }] = await Promise.all([
    service.from("plans").update(patch).eq("id", planId),
    service.from("plan_features").select("feature_key, enabled").eq("plan_id", planId),
    service.from("plan_limits").select("limit_key, limit_value").eq("plan_id", planId),
    service.from("plan_sections").select("section_key, enabled").eq("plan_id", planId),
  ])
  if (error) return { error: error.message }

  const curFMap = new Map((curF ?? []).map((x: { feature_key: string; enabled: boolean }) => [x.feature_key, x.enabled]))
  const curLMap = new Map((curL ?? []).map((x: { limit_key: string; limit_value: number | null }) => [x.limit_key, x.limit_value]))
  const curSMap = new Map((curS ?? []).map((x: { section_key: string; enabled: boolean }) => [x.section_key, x.enabled]))

  // Собираем логи изменений в один массив (одна вставка вместо десятков).
  const logs: Record<string, unknown>[] = []
  const pushLog = (action: string, field: string, oldV: unknown, newV: unknown) =>
    logs.push({ plan_id: planId, admin_id: auth.userId, admin_email: auth.email, action, field, old_value: oldV == null ? null : String(oldV), new_value: newV == null ? null : String(newV) })

  const tracked: (keyof typeof patch)[] = ["name", "code", "price", "old_price", "discount_percent", "currency", "period", "is_active", "is_popular", "is_recommended", "is_trial", "trial_days"]
  for (const fld of tracked) {
    if (String(cur[fld] ?? "") !== String((patch as Record<string, unknown>)[fld] ?? "")) pushLog("update", fld as string, cur[fld], (patch as Record<string, unknown>)[fld])
  }
  for (const [k, v] of Object.entries(p.features)) if (curFMap.get(k) !== v) pushLog("features", `feature.${k}`, curFMap.get(k) ? "ON" : "OFF", v ? "ON" : "OFF")
  for (const [k, v] of Object.entries(p.limits)) if (String(curLMap.get(k) ?? "∞") !== String(v ?? "∞")) pushLog("limits", `limit.${k}`, curLMap.get(k) ?? "∞", v ?? "∞")
  for (const [k, v] of Object.entries(p.sections)) if (curSMap.get(k) !== v) pushLog("sections", `section.${k}`, curSMap.get(k) ? "ON" : "OFF", v ? "ON" : "OFF")

  // Батч-запись: 3 upsert массивами + 1 вставка логов — параллельно.
  await Promise.all([
    service.from("plan_features").upsert(Object.entries(p.features).map(([k, v]) => ({ plan_id: planId, feature_key: k, enabled: v })), { onConflict: "plan_id,feature_key" }),
    service.from("plan_limits").upsert(Object.entries(p.limits).map(([k, v]) => ({ plan_id: planId, limit_key: k, limit_value: v })), { onConflict: "plan_id,limit_key" }),
    service.from("plan_sections").upsert(Object.entries(p.sections).map(([k, v]) => ({ plan_id: planId, section_key: k, enabled: v })), { onConflict: "plan_id,section_key" }),
    logs.length ? service.from("plan_change_logs").insert(logs) : Promise.resolve(),
  ])

  await revalidate()
  return { ok: true }
}

/** Архивировать / вернуть из архива. */
export async function archivePlanAction(planId: string, archived: boolean): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  const { error } = await service.from("plans").update({ is_archived: archived, is_active: archived ? false : true, updated_at: new Date().toISOString() }).eq("id", planId)
  if (error) return { error: error.message }
  await logChange(service, planId, auth, "archive", "is_archived", !archived, archived)
  await revalidate()
  return { ok: true }
}

/** Дублировать тариф со всеми фичами/лимитами/разделами. */
export async function duplicatePlanAction(planId: string): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
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
  const auth = await getPlatformAuth()
  if (!auth) return []
  const service = createServiceClient()
  const { data } = await service.from("plan_change_logs")
    .select("id, action, field, old_value, new_value, admin_email, created_at")
    .eq("plan_id", planId).order("created_at", { ascending: false }).limit(100)
  return (data ?? []) as PlanChangeLog[]
}

/** Удалить тариф — только если им никто не пользуется. */
export async function deletePlanAction(planId: string): Promise<Result> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "Нет прав" }
  const service = createServiceClient()
  const { count } = await service.from("clubs").select("id", { count: "exact", head: true }).eq("plan_id", planId)
  if ((count ?? 0) > 0) return { error: `Нельзя удалить: тариф используют ${count} клуб(ов). Архивируйте вместо удаления.` }
  const { error } = await service.from("plans").delete().eq("id", planId)
  if (error) return { error: error.message }
  await revalidate()
  return { ok: true }
}
