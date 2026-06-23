"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type MembershipFormState = { error?: string; ok?: boolean }

export async function createMembershipAction(
  _prev: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
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

  if (!name) {
    return { error: "Введите название абонемента" }
  }
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Некорректная цена" }
  }
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return { error: "Некорректный срок (дней)" }
  }

  // «unlim»/пусто = безлимит → null
  const isUnlim = visitsRaw === "" || visitsRaw === "unlim" || visitsRaw === "∞"
  const visitsLimit = isUnlim ? null : Number(visitsRaw)
  if (!isUnlim && (!Number.isFinite(visitsLimit) || (visitsLimit as number) < 0)) {
    return { error: "Некорректное количество посещений" }
  }

  // «Срок действия» dd.mm.yyyy → ISO date | null
  let validUntil: string | null = null
  if (validUntilRaw) {
    const m = validUntilRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (!m) return { error: "Срок действия: формат дд.мм.гггг" }
    validUntil = `${m[3]}-${m[2]}-${m[1]}`
    if (Number.isNaN(new Date(validUntil).getTime())) return { error: "Некорректный срок действия" }
  }

  // «Стоимость за 1 день»: free/пусто → null/0
  let pricePerDay: number | null = null
  if (pricePerDayRaw && pricePerDayRaw !== "free") {
    const n = Number(pricePerDayRaw.replace(/\s/g, ""))
    if (!Number.isFinite(n) || n < 0) return { error: "Некорректная стоимость за 1 день" }
    pricePerDay = n
  } else if (pricePerDayRaw === "free") {
    pricePerDay = 0
  }

  const availableDays = availableDaysRaw ? availableDaysRaw.split(",").filter(Boolean) : []
  const availableTime = availableTimeRaw ? availableTimeRaw.split(",").filter(Boolean) : []

  const club = await getCurrentClub()
  if (!club) {
    return { error: "Клуб не найден" }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("memberships").insert({
    club_id: club.clubId,
    name,
    price,
    duration_days: durationDays,
    visits_limit: visitsLimit,
    is_active: status !== "archived",
    freeze_days_allowed: freezeOn ? 30 : 0,
    description: description || null,
    valid_until: validUntil,
    price_per_day: pricePerDay,
    available_days: availableDays,
    available_time: availableTime,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/memberships")
  return { ok: true }
}
