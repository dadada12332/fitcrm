"use server"

import { createClient } from "@/lib/supabase/server"

export type OnboardingState = { error?: string; ok?: boolean }

async function getClubId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("staff")
    .select("club_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return data?.club_id ?? null
}

export async function saveClubInfoAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim()
  const city = String(formData.get("city") ?? "").trim()
  const address = String(formData.get("address") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()

  if (!name) return { error: "Введите название клуба" }

  const supabase = await createClient()
  let clubId = await getClubId()

  // Клуба нет — это нормально если при регистрации требовалось подтверждение email.
  // Создаём клуб сейчас через тот же RPC что и при обычной регистрации.
  if (!clubId) {
    const { data, error: rpcError } = await supabase.rpc("create_club", { p_name: name, p_city: city || null })
    if (rpcError) return { error: rpcError.message }
    clubId = data as string
    // Сразу обновляем настройки (адрес, телефон)
    const { error: settingsError } = await supabase
      .from("clubs")
      .update({ settings: { address, phone, onboarding_started: true, onboarding_step: 2 } })
      .eq("id", clubId)
    if (settingsError) return { error: settingsError.message }
    return { ok: true }
  }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    name,
    city: city || null,
    settings: { ...currentSettings, address, phone, onboarding_started: true, onboarding_step: 2 },
  }).eq("id", clubId)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveWorkingHoursAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const supabase = await createClient()
  const clubId = await getClubId()
  if (!clubId) return { error: "Аккаунт не привязан к клубу. Пройдите регистрацию заново." }

  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  const hours: Record<string, { open: string; close: string; closed: boolean }> = {}
  for (const d of days) {
    hours[d] = {
      open: String(formData.get(`${d}_open`) ?? "09:00"),
      close: String(formData.get(`${d}_close`) ?? "21:00"),
      closed: formData.get(`${d}_closed`) === "on",
    }
  }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...currentSettings, working_hours: hours, onboarding_started: true, onboarding_step: 3 },
  }).eq("id", clubId)

  if (error) return { error: error.message }

  return { ok: true }
}

export async function completeOnboardingAction(): Promise<OnboardingState> {
  const supabase = await createClient()
  const clubId = await getClubId()
  if (!clubId) return { error: "Сначала заполните информацию о клубе" }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}
  const { error } = await supabase.from("clubs").update({
    settings: {
      ...currentSettings,
      onboarding_started: true,
      onboarding_completed: true,
      onboarding_step: 4,
    },
  }).eq("id", clubId)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function createFirstMembershipAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim()
  const price = Number(formData.get("price") ?? 0)
  const durationDays = Number(formData.get("durationDays") ?? 30)

  if (!name) return { error: "Введите название абонемента" }
  if (price < 0) return { error: "Некорректная цена" }

  const supabase = await createClient()
  const clubId = await getClubId()
  if (!clubId) return { error: "Аккаунт не привязан к клубу. Пройдите регистрацию заново." }

  const { error } = await supabase.from("memberships").insert({
    club_id: clubId,
    name,
    price,
    duration_days: durationDays,
    is_active: true,
  })

  if (error) return { error: error.message }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}
  const { error: settingsError } = await supabase.from("clubs").update({
    settings: { ...currentSettings, onboarding_started: true, onboarding_step: 4 },
  }).eq("id", clubId)
  if (settingsError) return { error: settingsError.message }

  return { ok: true }
}
