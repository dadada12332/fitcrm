"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { getPlanByCode } from "@/lib/plans"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { can } from "@/lib/permissions"
import { requireIntegrationSlot, requirePlanFeature, requirePlanSection, requireRecordLimit } from "@/lib/plan-enforcement"

export type SaveResult = { ok?: boolean; error?: string }
type WorkingDay = { open: string; close: string; closed: boolean }

/** Заявка клуба на оформление/продление тарифа. Подтверждает админ платформы. */
export async function requestPlanAction(plan: string, months = 1): Promise<SaveResult> {
  // Цена берётся из БД (раздел «Тарифы» в Platform Admin) — без хардкода.
  const planRow = await getPlanByCode(plan)
  if (!planRow || planRow.is_trial || planRow.is_archived) return { error: "Неизвестный тариф" }
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }

  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient()

  // Одна активная заявка на клуб: старые pending отменяем.
  await service.from("platform_billing_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("club_id", club.clubId).eq("status", "pending")

  const { error } = await service.from("platform_billing_requests").insert({
    club_id: club.clubId,
    plan,
    months: Math.max(1, months),
    amount: planRow.price * Math.max(1, months),
    status: "pending",
    requested_by: user?.id ?? null,
    requested_email: user?.email ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { ok: true }
}

/** Заявка клуба на подключение приёма онлайн-оплат (Payme / Click). Без секретов. */
export async function requestPaymentConnectionAction(provider: "click" | "payme"): Promise<SaveResult> {
  if (provider !== "click" && provider !== "payme") return { error: "Неизвестный провайдер" }
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "integrations")) return { error: "Недостаточно прав" }
  const featureError = requirePlanFeature(club, "payment_integrations")
  if (featureError) return { error: featureError }

  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient()

  // Уже подключено или уже есть активная заявка — не дублируем.
  const { data: existing } = await service.from("payment_connection_requests")
    .select("id, status").eq("club_id", club.clubId).eq("provider", provider)
    .in("status", ["new", "active"]).limit(1).maybeSingle()
  if (existing?.status === "active") return { error: "Уже подключено" }
  if (existing?.status === "new") return { ok: true }
  const limitError = await requireIntegrationSlot(club)
  if (limitError) return { error: limitError }

  const { error } = await service.from("payment_connection_requests").insert({
    club_id: club.clubId, provider, status: "new",
    requested_by: user?.id ?? null, requested_email: user?.email ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath("/settings/finance")
  revalidatePath(`/integrations/${provider}`)
  revalidatePath("/integrations")
  return { ok: true }
}

/** Отмена своей заявки на подключение платёжки (пока не подтверждена). */
export async function cancelPaymentConnectionAction(provider: "click" | "payme"): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "integrations")) return { error: "Недостаточно прав" }
  const service = createServiceClient()
  await service.from("payment_connection_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("club_id", club.clubId).eq("provider", provider).eq("status", "new")
  revalidatePath("/settings/finance")
  return { ok: true }
}

/** Отмена своей заявки (pending). */
export async function cancelPlanRequestAction(): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }
  const service = createServiceClient()
  await service.from("platform_billing_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("club_id", club.clubId).eq("status", "pending")
  revalidatePath("/settings")
  return { ok: true }
}

export async function saveClubBasicAction(data: {
  name: string
  address: string
  phone: string
  email: string
  website: string
  timezone: string
  currency: string
  workingHours: Record<string, WorkingDay>
}): Promise<SaveResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "general")) return { error: "Недостаточно прав" }
  if (!data.name.trim()) return { error: "Укажите название клуба" }
  if (!/^\S+@\S+\.\S+$/.test(data.email) && data.email) return { error: "Проверьте email" }
  for (const hours of Object.values(data.workingHours)) {
    if (!/^\d{2}:\d{2}$/.test(hours.open) || !/^\d{2}:\d{2}$/.test(hours.close)) {
      return { error: "Проверьте рабочие часы" }
    }
    if (!hours.closed && hours.open >= hours.close) return { error: "Время закрытия должно быть позже времени открытия" }
  }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", club.clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    name: data.name.trim(),
    settings: {
      ...currentSettings,
      address: data.address,
      phone: data.phone,
      email: data.email,
      website: data.website,
      timezone: data.timezone,
      currency: data.currency,
      working_hours: data.workingHours,
    },
  }).eq("id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function saveNotificationsAction(settings: Record<string, boolean>): Promise<SaveResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "general")) return { error: "Недостаточно прав" }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", club.clubId).single()
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...currentSettings, notifications: settings },
  }).eq("id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function saveFinanceAction(data: {
  methods: string[]
}): Promise<SaveResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "general")) return { error: "Недостаточно прав" }

  const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", club.clubId).single()
  const cur = (clubRow?.settings as Record<string, unknown>) ?? {}
  const currentFinance = (cur.finance as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, finance: { ...currentFinance, methods: data.methods } },
  }).eq("id", club.clubId)

  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function changePasswordAction(currentPassword: string, password: string): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: "Не удалось определить аккаунт" }
  if (!currentPassword) return { error: "Введите текущий пароль" }
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (verifyError) return { error: "Текущий пароль неверен" }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function signOutOtherSessionsAction(): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }
  const { error } = await supabase.auth.signOut({ scope: "others" })
  return error ? { error: error.message } : { ok: true }
}

export async function inviteStaffAction(data: { email: string; role: string }): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!["owner", "admin"].includes(club.role)) return { error: "Нет прав для приглашения" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

  const email = data.email.toLowerCase().trim()
  const supabase = await createClient()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    supabase.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null),
  ])
  const staffLimitError = requireRecordLimit(club, "staff", (staffCount ?? 0) + (inviteCount ?? 0))
  if (staffLimitError) return { error: staffLimitError }
  const origin = (await headers()).get("origin") ?? ""

  // Delete stale unaccepted email invites for this email+club before creating a new one
  await supabase.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .eq("email", email)
    .is("accepted_at", null)

  // Store invite in DB (regular client — RLS allows owner/admin insert)
  const { data: invite, error: dbErr } = await supabase
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email, role: data.role })
    .select("id, token")
    .single()

  if (dbErr) return { error: dbErr.message }

  const redirectTo = `${origin}/auth/callback?next=/accept-invite/${invite.token}`
  const service = createServiceClient()

  // Try invite first (creates account for new users)
  const { error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { club_id: club.clubId, role: data.role, invite_token: invite.token },
  })

  if (inviteErr) {
    const isAlreadyRegistered = inviteErr.message.toLowerCase().includes("already")
    if (isAlreadyRegistered) {
      // Existing user — send a magic link so they can log in and reach the accept page
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
      if (otpErr) {
        await supabase.from("staff_invitations").delete().eq("id", invite.id)
        return { error: otpErr.message }
      }
      return { ok: true }
    }
    await supabase.from("staff_invitations").delete().eq("id", invite.id)
    return { error: inviteErr.message }
  }

  return { ok: true }
}

export async function saveIntegrationAction(key: string, value: string): Promise<SaveResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "integrations")) return { error: "Недостаточно прав" }
  if (key === "telegram") return { error: "Подключите Telegram в разделе «Интеграции»" }

  const updateField: Record<string, string> = {}
  if (Object.keys(updateField).length === 0) {
    const { data: clubRow } = await supabase.from("clubs").select("settings").eq("id", club.clubId).single()
    const cur = (clubRow?.settings as Record<string, unknown>) ?? {}
    const integrations = (cur.integrations as Record<string, string>) ?? {}
    const { error } = await supabase.from("clubs").update({
      settings: { ...cur, integrations: { ...integrations, [key]: value } },
    }).eq("id", club.clubId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from("clubs").update(updateField).eq("id", club.clubId)
    if (error) return { error: error.message }
  }

  revalidatePath("/settings/club")
  return { ok: true }
}

export async function createInviteLinkAction(data: { role: string }): Promise<{ url?: string; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!["owner", "admin"].includes(club.role)) return { error: "Нет прав для приглашения" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

  const supabase = await createClient()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    supabase.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null),
  ])
  const staffLimitError = requireRecordLimit(club, "staff", (staffCount ?? 0) + (inviteCount ?? 0))
  if (staffLimitError) return { error: staffLimitError }
  const origin = (await headers()).get("origin") ?? ""

  // Delete all stale unaccepted link invites for this club before creating a fresh one
  await supabase.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .is("email", null)
    .is("accepted_at", null)

  const { data: invite, error } = await supabase
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email: null, role: data.role })
    .select("token")
    .single()

  if (error) return { error: error.message }
  return { url: `${origin}/accept-invite/${invite.token}` }
}

export async function updateStaffRoleAction(staffId: string, role: string): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!["owner", "admin"].includes(club.role)) return { error: "Нет прав" }

  if (role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }

  const service = createServiceClient()
  const { data: staffRow } = await service
    .from("staff").select("role").eq("id", staffId).eq("club_id", club.clubId).maybeSingle()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner") return { error: "Нельзя изменить роль владельца" }

  const { error } = await service.from("staff").update({ role }).eq("id", staffId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function removeStaffAction(staffId: string): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!["owner", "admin"].includes(club.role)) return { error: "Нет прав" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient()

  const { data: staffRow } = await service
    .from("staff").select("role, user_id").eq("id", staffId).eq("club_id", club.clubId).maybeSingle()
  if (!staffRow) return { error: "Сотрудник не найден" }
  if (staffRow.role === "owner") return { error: "Нельзя удалить владельца" }
  if (staffRow.user_id === user?.id) return { error: "Нельзя удалить себя" }

  // Nullify FK references before deleting
  await Promise.all([
    service.from("visits").update({ staff_id: null }).eq("staff_id", staffId),
    service.from("schedules").update({ staff_id: null }).eq("staff_id", staffId),
    service.from("classes").update({ staff_id: null }).eq("staff_id", staffId),
  ])

  const { error } = await service.from("staff").delete().eq("id", staffId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function createBranchAction(data: {
  name: string
  address?: string
}): Promise<SaveResult & { clubId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }
  const currentClub = await getCurrentClub()
  if (!currentClub || currentClub.role !== "owner") return { error: "Только владелец может создать филиал" }
  if (!data.name.trim()) return { error: "Укажите название филиала" }
  const branchFeatureError = requirePlanFeature(currentClub, "multi_branch")
  if (branchFeatureError) return { error: branchFeatureError }
  const { count: branchCount } = await createServiceClient().from("staff")
    .select("club_id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("role", "owner").eq("is_active", true)
  const branchLimitError = requireRecordLimit(currentClub, "branches", branchCount ?? 0)
  if (branchLimitError) return { error: branchLimitError }

  const { data: clubId, error } = await supabase.rpc("create_club", {
    p_name: data.name.trim(),
    p_city: data.address?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/settings/branches")
  revalidatePath("/")
  return { ok: true, clubId: clubId as string }
}
