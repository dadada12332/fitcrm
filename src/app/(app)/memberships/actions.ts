"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type MembershipFormState = { error?: string; ok?: boolean }

type MembershipPayload = {
  name: string
  price: number
  duration_days: number
  visits_limit: number | null
  is_active: boolean
  archived: boolean
  freeze_days_allowed: number
  description: string | null
  valid_until: string | null
  price_per_day: number | null
  available_days: string[]
  available_time: string[]
}

/** Разбор и валидация полей формы абонемента (общий для create/update). */
function parseMembershipForm(formData: FormData): { error?: string; data?: MembershipPayload } {
  const name = String(formData.get("name") ?? "").trim()
  const price = Number(formData.get("price") ?? 0)
  const durationDays = Number(formData.get("duration_days") ?? 0)
  const visitsRaw = String(formData.get("visits_limit") ?? "").trim().toLowerCase()
  const status = String(formData.get("status") ?? "active")
  const freezeOn = String(formData.get("freeze_allowed") ?? "") === "on"
  const description = String(formData.get("description") ?? "").trim()
  const validUntilRaw = String(formData.get("valid_until") ?? "").trim()
  const pricePerDayRaw = String(formData.get("price_per_day") ?? "").trim().toLowerCase()
  const availableDaysRaw = String(formData.get("available_days") ?? "").trim()
  const availableTimeRaw = String(formData.get("available_time") ?? "").trim()

  if (!name) return { error: "Введите название абонемента" }
  if (!Number.isFinite(price) || price < 0) return { error: "Некорректная цена" }
  if (!Number.isFinite(durationDays) || durationDays <= 0) return { error: "Некорректный срок (дней)" }

  const isUnlim = visitsRaw === "" || visitsRaw === "unlim" || visitsRaw === "∞"
  const visitsLimit = isUnlim ? null : Number(visitsRaw)
  if (!isUnlim && (!Number.isFinite(visitsLimit) || (visitsLimit as number) < 0)) {
    return { error: "Некорректное количество посещений" }
  }

  let validUntil: string | null = null
  if (validUntilRaw) {
    const m = validUntilRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (!m) return { error: "Срок действия: формат дд.мм.гггг" }
    validUntil = `${m[3]}-${m[2]}-${m[1]}`
    if (Number.isNaN(new Date(validUntil).getTime())) return { error: "Некорректный срок действия" }
  }

  let pricePerDay: number | null = null
  if (pricePerDayRaw && pricePerDayRaw !== "free") {
    const n = Number(pricePerDayRaw.replace(/\s/g, ""))
    if (!Number.isFinite(n) || n < 0) return { error: "Некорректная стоимость за 1 день" }
    pricePerDay = n
  } else if (pricePerDayRaw === "free") {
    pricePerDay = 0
  }

  return {
    data: {
      name,
      price,
      duration_days: durationDays,
      visits_limit: visitsLimit,
      is_active: status === "active",
      archived: status === "archived",
      freeze_days_allowed: freezeOn ? 30 : 0,
      description: description || null,
      valid_until: validUntil,
      price_per_day: pricePerDay,
      available_days: availableDaysRaw ? availableDaysRaw.split(",").filter(Boolean) : [],
      available_time: availableTimeRaw ? availableTimeRaw.split(",").filter(Boolean) : [],
    },
  }
}

export async function createMembershipAction(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  const parsed = parseMembershipForm(formData)
  if (parsed.error || !parsed.data) return { error: parsed.error }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const supabase = await createClient()
  const { error } = await supabase.from("memberships").insert({ club_id: club.clubId, ...parsed.data })
  if (error) return { error: error.message }

  revalidatePath("/memberships")
  return { ok: true }
}

export async function updateMembershipAction(_prev: MembershipFormState, formData: FormData): Promise<MembershipFormState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Не указан тариф" }

  const name = String(formData.get("name") ?? "").trim()
  const price = Number(formData.get("price") ?? 0)
  const durationDays = Number(formData.get("duration_days") ?? 0)
  const status = String(formData.get("status") ?? "active")
  const freezeOn = String(formData.get("freeze_allowed") ?? "") === "on"
  const description = String(formData.get("description") ?? "").trim()
  const validUntilRaw = String(formData.get("valid_until") ?? "").trim()
  const availableDaysRaw = String(formData.get("available_days") ?? "").trim()
  const availableTimeRaw = String(formData.get("available_time") ?? "").trim()

  if (!name) return { error: "Введите название абонемента" }
  if (!Number.isFinite(price) || price < 0) return { error: "Некорректная цена" }
  if (!Number.isFinite(durationDays) || durationDays <= 0) return { error: "Некорректный срок (дней)" }

  let validUntil: string | null = null
  if (validUntilRaw) {
    const m = validUntilRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (!m) return { error: "Срок действия: формат дд.мм.гггг" }
    validUntil = `${m[3]}-${m[2]}-${m[1]}`
    if (Number.isNaN(new Date(validUntil).getTime())) return { error: "Некорректный срок действия" }
  }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const supabase = await createClient()
  // поля по новому дизайну дровера (visits_limit/price_per_day из формы убраны — не трогаем)
  const { error } = await supabase
    .from("memberships")
    .update({
      name,
      price,
      duration_days: durationDays,
      is_active: status === "active",
      archived: status === "archived",
      freeze_days_allowed: freezeOn ? 30 : 0,
      description: description || null,
      valid_until: validUntil,
      available_days: availableDaysRaw ? availableDaysRaw.split(",").filter(Boolean) : [],
      available_time: availableTimeRaw ? availableTimeRaw.split(",").filter(Boolean) : [],
    })
    .eq("id", id)
    .eq("club_id", club.clubId)
  if (error) return { error: error.message }

  revalidatePath("/memberships")
  return { ok: true }
}

export async function duplicateMembershipAction(id: string): Promise<MembershipFormState> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  const supabase = await createClient()

  const { data: m, error: e1 } = await supabase
    .from("memberships")
    .select("name, price, duration_days, visits_limit, freeze_days_allowed, description, valid_until, price_per_day, available_days, available_time")
    .eq("id", id)
    .eq("club_id", club.clubId)
    .maybeSingle()
  if (e1) return { error: e1.message }
  if (!m) return { error: "Тариф не найден" }

  const { error: e2 } = await supabase.from("memberships").insert({
    club_id: club.clubId,
    ...m,
    name: `${m.name} (копия)`,
    is_active: true,
    archived: false,
  })
  if (e2) return { error: e2.message }

  revalidatePath("/memberships")
  return { ok: true }
}

export async function setMembershipActiveAction(id: string, isActive: boolean): Promise<MembershipFormState> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  const supabase = await createClient()
  const { error } = await supabase
    .from("memberships")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/memberships")
  return { ok: true }
}

export async function setMembershipArchivedAction(id: string, archived: boolean): Promise<MembershipFormState> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  const supabase = await createClient()
  const { error } = await supabase
    .from("memberships")
    .update({ archived, is_active: !archived })
    .eq("id", id)
    .eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/memberships")
  return { ok: true }
}

export async function deleteMembershipAction(id: string): Promise<MembershipFormState> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  const supabase = await createClient()
  const { error } = await supabase.from("memberships").delete().eq("id", id).eq("club_id", club.clubId)
  if (error) {
    if (error.code === "23503") {
      return { error: "Нельзя удалить: на тариф есть подписки. Отключите или архивируйте его." }
    }
    return { error: error.message }
  }
  revalidatePath("/memberships")
  return { ok: true }
}
