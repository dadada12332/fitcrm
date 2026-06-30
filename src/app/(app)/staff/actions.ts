"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"
import type { StaffSettings } from "@/lib/staff"

type R = { ok?: boolean; error?: string }

export async function addStaffAction(data: {
  name: string; email: string; phone: string; role: string
  salaryType: string; salaryFixed: number; salaryPercent: number
}): Promise<R & { id?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const uid = crypto.randomUUID()
  const { error: ue } = await supabase.from("users").insert({
    id: uid, email: data.email, full_name: data.name,
  })
  if (ue) return { error: ue.message }

  const settings: StaffSettings = {
    phone:          data.phone,
    status:         "active",
    salary_type:    data.salaryType as StaffSettings["salary_type"],
    salary_fixed:   data.salaryFixed,
    salary_percent: data.salaryPercent,
    hired_at:       new Date().toISOString().slice(0, 10),
    permissions:    { clients: true, visits: true, payments: false, inventory: false, finance: false, settings: false },
    salary_history: [],
  }

  const { data: staffRow, error: se } = await supabase.from("staff").insert({
    user_id: uid, club_id: club.clubId, role: data.role,
    salary: data.salaryFixed || null, settings,
  }).select("id").single()

  if (se) return { error: se.message }
  revalidatePath("/staff")
  return { ok: true, id: staffRow?.id }
}

export async function updateStaffBasicAction(staffId: string, data: {
  name: string; phone: string; dob: string; hiredAt: string; role: string
}): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("user_id, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}

  const [, se] = await Promise.all([
    supabase.from("users").update({ full_name: data.name }).eq("id", staffRow.user_id),
    supabase.from("staff").update({
      role: data.role,
      settings: { ...cur, phone: data.phone, dob: data.dob, hired_at: data.hiredAt },
    }).eq("id", staffId),
  ])

  if (se?.error) return { error: se.error.message }
  revalidatePath("/staff")
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffSalaryAction(staffId: string, data: {
  salaryType: string; salaryFixed: number; salaryPercent: number
}): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await supabase.from("staff").update({
    salary: data.salaryFixed || null,
    settings: {
      ...cur,
      salary_type:    data.salaryType,
      salary_fixed:   data.salaryFixed,
      salary_percent: data.salaryPercent,
    },
  }).eq("id", staffId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function payStaffAction(staffId: string, amount: number, note: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const history = cur.salary_history ?? []
  const newEntry = { date: new Date().toISOString().slice(0, 10), amount, note }

  const { error } = await supabase.from("staff").update({
    settings: { ...cur, salary_history: [newEntry, ...history] },
  }).eq("id", staffId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffPermissionsAction(staffId: string, permissions: Record<string, boolean>): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await supabase.from("staff").update({
    settings: { ...cur, permissions },
  }).eq("id", staffId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffRoleAction(staffId: string, roleKey: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!["owner", "admin"].includes(club.role)) return { error: "Нет прав на смену роли" }

  const { error } = await supabase
    .from("staff")
    .update({ role: roleKey })
    .eq("id", staffId)
    .eq("club_id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath("/staff")
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffStatusAction(staffId: string, status: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await supabase.from("staff").update({
    is_active: status !== "fired",
    settings:  { ...cur, status },
  }).eq("id", staffId)

  if (error) return { error: error.message }
  revalidatePath("/staff")
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}
