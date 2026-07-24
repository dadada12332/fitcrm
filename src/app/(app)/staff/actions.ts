"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import type { StaffSettings } from "@/lib/staff"
import { requirePlanSection, requireRecordLimit } from "@/lib/plan-enforcement"
import { can } from "@/lib/permissions"

type R = { ok?: boolean; error?: string }

function permissionsAreSubset(target: unknown, actor: unknown): boolean {
  if (typeof target === "boolean") return target === false || actor === true
  if (!target || typeof target !== "object" || !actor || typeof actor !== "object") return false
  return Object.entries(target as Record<string, unknown>).every(
    ([key, value]) => permissionsAreSubset(value, (actor as Record<string, unknown>)[key]),
  )
}

async function canAssignRole(clubId: string, actorRole: string, actorPermissions: unknown, targetRole: string): Promise<boolean> {
  if (actorRole === "owner") return true
  if (targetRole === "owner") return false
  const { data } = await createServiceClient()
    .from("club_roles")
    .select("permissions")
    .eq("club_id", clubId)
    .eq("key", targetRole)
    .maybeSingle()
  return Boolean(data?.permissions && permissionsAreSubset(data.permissions, actorPermissions))
}

export async function addStaffAction(data: {
  name: string; email: string; phone: string; role: string
  salaryType: string; salaryFixed: number; salaryPercent: number
}): Promise<R & { id?: string; invited?: boolean }> {
  const supabase = await createClient()
  const service = createServiceClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "staff", "create")) return { error: "Недостаточно прав" }
  if (![data.salaryFixed, data.salaryPercent].every((value) => Number.isFinite(value) && value >= 0)) {
    return { error: "Зарплата и процент не могут быть отрицательными" }
  }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }
  if (!(await canAssignRole(club.clubId, club.role, club.permissions, data.role))) {
    return { error: "Нельзя назначить роль с более широкими правами" }
  }
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null),
  ])
  const limitError = requireRecordLimit(club, "staff", (staffCount ?? 0) + (inviteCount ?? 0))
  if (limitError) return { error: limitError }

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
    const { data: staffRow, error: se } = await createServiceClient().from("staff").insert({
      user_id: existingUser.id, club_id: club.clubId, role: data.role,
      salary: data.salaryFixed || null, settings,
    }).select("id").single()

    if (se) return { error: se.message }
    revalidatePath("/staff")
    return { ok: true, id: staffRow?.id }
  }

  // User doesn't exist — send email invite via Supabase Auth Admin
  await service.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .eq("email", email)
    .is("accepted_at", null)

  const { data: invite, error: dbErr } = await service
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email, role: data.role, invited_by: (await supabase.auth.getUser()).data.user?.id ?? null })
    .select("id, token")
    .single()

  if (dbErr) return { error: dbErr.message }

  const redirectTo = `${origin}/auth/callback?next=/accept-invite/${invite.token}`
  const { error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: data.name, club_id: club.clubId, role: data.role, invite_token: invite.token },
  })

  if (inviteErr) {
    await service.from("staff_invitations").delete().eq("id", invite.id)
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
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "staff", "edit")) return { error: "Недостаточно прав" }

  const { data: staffRow } = await createServiceClient()
    .from("staff")
    .select("user_id, role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  // Защита от эскалации: владельца может менять только владелец, и назначить owner может только владелец
  if (staffRow.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить владельца" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }
  if (!(await canAssignRole(club.clubId, club.role, club.permissions, data.role))) {
    return { error: "Нельзя назначить роль с более широкими правами" }
  }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const service = createServiceClient()

  const [, se] = await Promise.all([
    service.from("users").update({ full_name: data.name }).eq("id", staffRow.user_id),
    service.from("staff").update({
      role: data.role,
      settings: { ...cur, phone: data.phone, dob: data.dob, hired_at: data.hiredAt },
    }).eq("id", staffId).eq("club_id", club.clubId),
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
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "staff", "salaries")) return { error: "Недостаточно прав" }
  if (![data.salaryFixed, data.salaryPercent].every((value) => Number.isFinite(value) && value >= 0)) {
    return { error: "Зарплата и процент не могут быть отрицательными" }
  }

  const { data: staffRow } = await createServiceClient()
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await createServiceClient().from("staff").update({
    salary: data.salaryFixed || null,
    settings: {
      ...cur,
      salary_type:    data.salaryType,
      salary_fixed:   data.salaryFixed,
      salary_percent: data.salaryPercent,
    },
  }).eq("id", staffId).eq("club_id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function payStaffAction(staffId: string, amount: number, note: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "staff", "salaries")) return { error: "Недостаточно прав" }
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Введите корректную сумму выплаты" }

  const { data: staffRow } = await createServiceClient()
    .from("staff")
    .select("settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const history = cur.salary_history ?? []
  const newEntry = { date: new Date().toISOString().slice(0, 10), amount, note }

  const { error } = await createServiceClient().from("staff").update({
    settings: { ...cur, salary_history: [newEntry, ...history] },
  }).eq("id", staffId).eq("club_id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffPermissionsAction(staffId: string, permissions: Record<string, boolean>): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "settings", "roles")) return { error: "Недостаточно прав" }

  const { data: staffRow } = await createServiceClient()
    .from("staff")
    .select("role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить права владельца" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await createServiceClient().from("staff").update({
    settings: { ...cur, permissions },
  }).eq("id", staffId).eq("club_id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}

export async function updateStaffRoleAction(staffId: string, roleKey: string): Promise<R> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "settings", "roles")) return { error: "Нет прав на смену роли" }

  // Fetch current role for audit log
  const { data: current } = await createServiceClient()
    .from("staff")
    .select("role, user_id")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!current) return { error: "Сотрудник не найден" }
  if (current.role === "owner" && club.role !== "owner") return { error: "Нельзя изменить роль владельца" }
  if (roleKey === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }
  if (!(await canAssignRole(club.clubId, club.role, club.permissions, roleKey))) {
    return { error: "Нельзя назначить роль с более широкими правами" }
  }

  const { error } = await createServiceClient()
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
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!(can(club.permissions, "staff", "edit") || can(club.permissions, "staff", "delete"))) return { error: "Недостаточно прав" }

  const { data: staffRow } = await createServiceClient()
    .from("staff")
    .select("role, settings")
    .eq("id", staffId)
    .eq("club_id", club.clubId)
    .single()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner") return { error: "Нельзя изменить статус владельца" }

  const cur = (staffRow.settings as StaffSettings) ?? {}
  const { error } = await createServiceClient().from("staff").update({
    is_active: status !== "fired",
    settings:  { ...cur, status },
  }).eq("id", staffId).eq("club_id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath("/staff")
  revalidatePath(`/staff/${staffId}`)
  return { ok: true }
}
