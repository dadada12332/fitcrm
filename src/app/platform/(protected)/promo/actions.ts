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

export type CompensationPayload = {
  clubIds: string[]
  benefitType: "free_days" | "discount_pct"
  value: number
  reason: string
  expiresAt: string | null
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

async function notifyCompensatedClub(input: {
  clubId: string
  title: string
  body: string
  adminId: string
}) {
  const service = createServiceClient()
  const { data: owners } = await service.from("staff")
    .select("id, user_id")
    .eq("club_id", input.clubId)
    .eq("role", "owner")
    .eq("is_active", true)
  if (!owners?.length) return

  const now = new Date().toISOString()
  const { data: campaign } = await service.from("platform_broadcasts").insert({
    title: input.title,
    body: input.body,
    category: "important",
    audience: { kind: "clubs", value: [input.clubId] },
    status: "sent",
    scheduled_at: now,
    recipient_count: owners.length,
    delivered_count: owners.length,
    created_by: input.adminId,
    sent_at: now,
  }).select("id").single()
  if (!campaign) return

  await service.from("platform_broadcast_deliveries").insert(owners.map((owner) => ({
    broadcast_id: campaign.id,
    club_id: input.clubId,
    staff_id: owner.id,
    user_id: owner.user_id,
    status: "delivered",
    delivered_at: now,
  })))
}

export async function createClubCompensationAction(input: CompensationPayload): Promise<Result & { created?: number }> {
  const auth = await requirePlatformPermission("promos.manage")
  const clubIds = Array.from(new Set(input.clubIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id))))
  const reason = input.reason.trim()
  if (!clubIds.length) return { error: "Выберите хотя бы один клуб" }
  if (clubIds.length > 100) return { error: "За один раз можно выбрать не более 100 клубов" }
  if (!["free_days", "discount_pct"].includes(input.benefitType)) return { error: "Неизвестный тип компенсации" }
  if (!Number.isInteger(input.value)) return { error: "Значение должно быть целым числом" }
  if (input.benefitType === "free_days" && (input.value < 1 || input.value > 365)) return { error: "Бесплатные дни: от 1 до 365" }
  if (input.benefitType === "discount_pct" && (input.value < 1 || input.value > 100)) return { error: "Скидка: от 1 до 100%" }
  if (reason.length < 3 || reason.length > 500) return { error: "Причина: от 3 до 500 символов" }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
    return { error: "Срок действия должен быть в будущем" }
  }

  const service = createServiceClient()
  const { data: existingClubs, error: clubsError } = await service.from("clubs")
    .select("id, name")
    .in("id", clubIds)
    .neq("status", "deleted")
  if (clubsError) return { error: "Не удалось проверить клубы" }
  if ((existingClubs ?? []).length !== clubIds.length) return { error: "Один из выбранных клубов не найден" }
  const clubNameById = new Map((existingClubs ?? []).map((club) => [club.id, club.name]))

  if (input.benefitType === "free_days") {
    for (const clubId of clubIds) {
      const { error } = await service.rpc("platform_apply_free_days_compensation", {
        p_club_id: clubId,
        p_days: input.value,
        p_reason: reason,
        p_admin_id: auth.userId,
      })
      if (error) return { error: `Не удалось начислить дни клубу «${clubNameById.get(clubId) ?? "Клуб"}»` }
      await notifyCompensatedClub({
        clubId,
        adminId: auth.userId,
        title: `Компенсация: +${input.value} дней`,
        body: `${reason}\n\nМы уже продлили срок вашей подписки на ${input.value} дней. Никаких действий не требуется.`,
      })
    }
  } else {
    const { data: previous } = await service.from("platform_club_compensations")
      .select("id")
      .in("club_id", clubIds)
      .eq("benefit_type", "discount_pct")
      .eq("status", "active")
    for (const item of previous ?? []) {
      const { error } = await service.rpc("platform_cancel_club_compensation", {
        p_compensation_id: item.id,
        p_admin_id: auth.userId,
      })
      if (error) return { error: "Не удалось заменить предыдущую компенсацию" }
    }

    const { error } = await service.from("platform_club_compensations").insert(clubIds.map((clubId) => ({
      club_id: clubId,
      benefit_type: "discount_pct",
      value: input.value,
      reason,
      status: "active",
      expires_at: expiresAt?.toISOString() ?? null,
      created_by: auth.userId,
    })))
    if (error) return { error: "Не удалось создать компенсацию" }
    for (const clubId of clubIds) {
      await notifyCompensatedClub({
        clubId,
        adminId: auth.userId,
        title: `Компенсация: скидка ${input.value}%`,
        body: `${reason}\n\nСкидка ${input.value}% применится автоматически при следующем оформлении или продлении тарифа.`,
      })
    }
  }

  await logPlatformAction({
    action: "club_compensation_create",
    meta: { clubIds, benefitType: input.benefitType, value: input.value, reason, expiresAt: expiresAt?.toISOString() ?? null },
  })
  await refresh()
  return { ok: true, created: clubIds.length }
}

export async function cancelClubCompensationAction(id: string): Promise<Result> {
  const auth = await requirePlatformPermission("promos.manage")
  const service = createServiceClient()
  const { data, error } = await service.rpc("platform_cancel_club_compensation", {
    p_compensation_id: id,
    p_admin_id: auth.userId,
  })
  if (error) return { error: "Компенсация уже применена или отменена" }
  const result = (data ?? {}) as { club_id?: string; detached_requests?: number }
  await logPlatformAction({
    action: "club_compensation_cancel",
    clubId: result.club_id ?? null,
    meta: { compensationId: id, detachedRequests: result.detached_requests ?? 0 },
  })
  await refresh()
  return { ok: true }
}
