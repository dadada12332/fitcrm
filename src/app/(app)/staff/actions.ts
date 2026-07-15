"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import type { StaffSettings } from "@/lib/staff"

type R = { ok?: boolean; error?: string }

export async function addStaffAction(data: {
  name: string; email: string; phone: string; role: string
  salaryType: string; salaryFixed: number; salaryPercent: number
}): Promise<R & { id?: string; invited?: boolean }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!(["owner", "admin"].includes(club.role) || club.permissions.staff.create)) return { error: "Недостаточно прав" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

  const email = data.email.toLowerCase().trim()
  const origin = (await headers()).get("origin") ?? ""

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

  // Check if user already exists in auth (via public.users mirror)
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existingUser) {
    // User already has an account — link them directly as staff
    const { data: staffRow, error: se } = await supabase.from("staff").insert({
      user_id: existingUser.id, club_id: club.clubId, role: data.role,
      salary: data.salaryFixed || null, settings,
    }).select("id").single()

    if (se) return { error: se.message }
    revalidatePath("/staff")
    return { ok: true, id: staffRow?.id }
  }

  // User doesn't exist — send email invite via Supabase Auth Admin
  await supabase.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .eq("email", email)
    .is("accepted_at", null)

  const { data: invite, error: dbErr } = await supabase
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email, role: data.role })
    .select("id, token")
    .single()

  if (dbErr) return { error: dbErr.message }

  const redirectTo = `${origin}/auth/callback?next=/accept-invite/${invite.token}`
  const service = createServiceClient()

  const { error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: data.name, club_id: club.clubId, role: data.role, invite_token: invite.token },
  })

  if (inviteErr) {
    await supabase.from("staff_invitations").delete().eq("id", invite.id)
    return { error: inviteErr.message }
  }

  revalidatePath("/staff")
  return { ok: true, invited: true }
}

export async function updateStaffBasicAction(staffId: string, data: {
  name: string; phone: string; dob: string; hiredAt: string; role: string
}): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!(["owner", "admin"].includes(club.role) || club.permissions.staff.edit)) return { error: "Недостаточно прав" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("user_id, role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  // Защита от эскалации: владельца может менять только владелец, и назначить owner может только владелец
  if (staffRow.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить владельца" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

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
  if (!(["owner", "admin"].includes(club.role) || club.permissions.staff.salaries)) return { error: "Недостаточно прав" }

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
  if (!(["owner", "admin"].includes(club.role) || club.permissions.staff.salaries)) return { error: "Недостаточно прав" }

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
  if (!["owner", "admin"].includes(club.role)) return { error: "Недостаточно прав" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить права владельца" }

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

  // Fetch current role for audit log
  const { data: current } = await supabase
    .from("staff")
    .select("role, user_id")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!current) return { error: "Сотрудник не найден" }
  if (current.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить роль владельца" }
  if (roleKey === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

  const { error } = await supabase
    .from("staff")
    .update({ role: roleKey })
    .eq("id", staffId)
    .eq("club_id", club.clubId)

  if (error) return { error: error.message }

  // Write audit log
  const { data: { user } } = await supabase.auth.getUser()
  if (user && current) {
    await supabase.from("audit_logs").insert({
      club_id:    club.clubId,
      user_id:    user.id,
      action:     "role_change",
      table_name: "staff",
      record_id:  staffId,
      old_data:   { role: current.role, staff_user_id: current.user_id },
      new_data:   { role: roleKey, staff_user_id: current.user_id },
    })
  }

  revalidatePath("/staff")
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffStatusAction(staffId: string, status: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!(["owner", "admin"].includes(club.role) || club.permissions.staff.edit || club.permissions.staff.delete)) return { error: "Недостаточно прав" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner") return { error: "Нельзя изменить статус владельца" }

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
