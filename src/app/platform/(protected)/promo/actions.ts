"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { logPlatformAction, platformBase, requirePlatformPermission } from "@/lib/platform"

export type PromoPayload = {
  id?: string
  code: string
  description: string
  discountPct: number | null
  freeDays: number | null
  maxUses: number | null
  startsAt: string | null
  expiresAt: string | null
  planCodes: string[]
}

type Result = { ok?: boolean; error?: string }
const ALLOWED_PLANS = new Set(["starter", "standard", "business"])

function validate(payload: PromoPayload): string | null {
  if (!/^[A-Z0-9_-]{3,32}$/.test(payload.code)) return "Код: 3–32 символа A–Z, 0–9, _ или -"
  if (payload.discountPct == null && payload.freeDays == null) return "Укажите скидку или бесплатные дни"
  if (payload.discountPct != null && (!Number.isInteger(payload.discountPct) || payload.discountPct < 1 || payload.discountPct > 100)) return "Скидка должна быть от 1 до 100%"
  if (payload.freeDays != null && (!Number.isInteger(payload.freeDays) || payload.freeDays < 1 || payload.freeDays > 365)) return "Бесплатные дни: от 1 до 365"
  if (payload.maxUses != null && (!Number.isInteger(payload.maxUses) || payload.maxUses < 1)) return "Лимит использований должен быть больше нуля"
  if (payload.planCodes.some((plan) => !ALLOWED_PLANS.has(plan))) return "Выбран неизвестный тариф"
  if (payload.startsAt && payload.expiresAt && new Date(payload.startsAt) >= new Date(payload.expiresAt)) return "Дата окончания должна быть позже даты начала"
  return null
}

async function refresh() {
  const base = await platformBase()
  revalidatePath(`${base}/promo`)
}

export async function savePlatformPromoAction(input: PromoPayload): Promise<Result> {
  const auth = await requirePlatformPermission("promos.manage")
  const payload = {
    ...input,
    code: input.code.trim().toUpperCase(),
    description: input.description.trim(),
    planCodes: Array.from(new Set(input.planCodes)),
  }
  const validationError = validate(payload)
  if (validationError) return { error: validationError }

  const service = createServiceClient()
  const patch = {
    code: payload.code,
    description: payload.description,
    discount_pct: payload.discountPct,
    free_days: payload.freeDays,
    max_uses: payload.maxUses,
    starts_at: payload.startsAt,
    expires_at: payload.expiresAt,
    plan_codes: payload.planCodes,
    updated_at: new Date().toISOString(),
  }

  if (payload.id) {
    const { data, error } = await service.from("platform_promo_codes")
      .update(patch).eq("id", payload.id).select("id").maybeSingle()
    if (error?.code === "23505") return { error: "Такой промокод уже существует" }
    if (error || !data) return { error: "Не удалось сохранить промокод" }
    await logPlatformAction({ action: "promo_update", meta: { promoId: payload.id, code: payload.code } })
  } else {
    const { data, error } = await service.from("platform_promo_codes")
      .insert({ ...patch, created_by: auth.userId }).select("id").single()
    if (error?.code === "23505") return { error: "Такой промокод уже существует" }
    if (error || !data) return { error: "Не удалось создать промокод" }
    await logPlatformAction({ action: "promo_create", meta: { promoId: data.id, code: payload.code } })
  }
  await refresh()
  return { ok: true }
}

export async function setPlatformPromoActiveAction(id: string, active: boolean): Promise<Result> {
  await requirePlatformPermission("promos.manage")
  const service = createServiceClient()
  const { data, error } = await service.from("platform_promo_codes")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id).select("code").maybeSingle()
  if (error || !data) return { error: "Промокод не найден" }
  await logPlatformAction({ action: active ? "promo_activate" : "promo_archive", meta: { promoId: id, code: data.code } })
  await refresh()
  return { ok: true }
}
