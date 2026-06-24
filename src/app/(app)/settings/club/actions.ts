"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SaveResult = { ok?: boolean; error?: string }

export async function saveClubBasicAction(data: {
  name: string
  address: string
  phone: string
  email: string
  website: string
  timezone: string
  currency: string
}): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const currentSettings = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    name: data.name,
    settings: {
      ...currentSettings,
      address: data.address,
      phone: data.phone,
      email: data.email,
      website: data.website,
      timezone: data.timezone,
      currency: data.currency,
    },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function saveNotificationsAction(settings: Record<string, boolean>): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const currentSettings = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...currentSettings, notifications: settings },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function saveFinanceAction(data: {
  methods: string[]
  autoNum: boolean
  categories: string[]
}): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, finance: data },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function changePasswordAction(password: string): Promise<SaveResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveBranchAction(data: { name: string; address: string }): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}
  const branches = (cur.branches as { name: string; address: string }[]) ?? []

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, branches: [...branches, data] },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function inviteStaffAction(data: { email: string; role: string }): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase.from("staff").select("club_id, role").eq("user_id", user.id).single()
  if (!staffRow?.club_id) return { error: "Клуб не найден" }
  if (!["owner", "admin"].includes(staffRow.role)) return { error: "Нет прав для приглашения" }

  const { data: inv, error } = await supabase.auth.admin.inviteUserByEmail(data.email, {
    data: { invited_role: data.role, club_id: staffRow.club_id },
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveIntegrationAction(key: string, value: string): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const updateField: Record<string, string> = key === "telegram" ? { tg_token: value } : {}
  if (Object.keys(updateField).length === 0) {
    const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
    const cur = (club?.settings as Record<string, unknown>) ?? {}
    const integrations = (cur.integrations as Record<string, string>) ?? {}
    const { error } = await supabase.from("clubs").update({
      settings: { ...cur, integrations: { ...integrations, [key]: value } },
    }).eq("id", staff.club_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from("clubs").update(updateField).eq("id", staff.club_id)
    if (error) return { error: error.message }
  }

  revalidatePath("/settings/club")
  return { ok: true }
}
