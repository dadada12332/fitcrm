"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { getPlanByCode } from "@/lib/plans"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { can } from "@/lib/permissions"
import { requireIntegrationSlot, requirePlanFeature, requirePlanSection, requireRecordLimit } from "@/lib/plan-enforcement"
import { APP_LOCALES, normalizeAppLocale, type AppLocale } from "@/lib/app-locale"

export type SaveResult = { ok?: boolean; error?: string }
type WorkingDay = { open: string; close: string; closed: boolean }

function permissionsAreSubset(target: unknown, actor: unknown): boolean {
  if (typeof target === "boolean") return target === false || actor === true
  if (!target || typeof target !== "object" || !actor || typeof actor !== "object") return false
  return Object.entries(target as Record<string, unknown>).every(
    ([key, value]) => permissionsAreSubset(value, (actor as Record<string, unknown>)[key]),
  )
}

async function canInviteRole(clubId: string, actorRole: string, actorPermissions: unknown, role: string): Promise<boolean> {
  if (actorRole === "owner") return true
  if (role === "owner") return false
  const { data } = await createServiceClient().from("club_roles")
    .select("permissions").eq("club_id", clubId).eq("key", role).maybeSingle()
  return Boolean(data?.permissions && permissionsAreSubset(data.permissions, actorPermissions))
}

/** Заявка клуба на оформление/продление тарифа. Подтверждает админ платформы. */
export async function requestPlanAction(plan: string, months = 1, promoCode?: string): Promise<SaveResult> {
  // Цена берётся из БД (раздел «Тарифы» в Platform Admin) — без хардкода.
  const planRow = await getPlanByCode(plan)
  if (!planRow || planRow.is_trial || planRow.is_archived) return { error: "Неизвестный тариф" }
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }

  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient()
  const normalizedMonths = Math.max(1, Math.min(12, Math.floor(months)))
  const baseAmount = planRow.price * normalizedMonths
  type PromoQuote = { id: string; code: string; discount_amount: number; final_amount: number }
  let promo: PromoQuote | null = null
  if (promoCode?.trim()) {
    const { data, error: promoError } = await service.rpc("platform_quote_promo", {
      p_code: promoCode.trim(),
      p_plan: plan,
      p_months: normalizedMonths,
      p_base_amount: baseAmount,
    })
    if (promoError) {
      const message = promoError.message
      if (message.includes("promo_not_found")) return { error: "Промокод не найден" }
      if (message.includes("promo_inactive") || message.includes("promo_expired")) return { error: "Промокод больше не действует" }
      if (message.includes("promo_not_started")) return { error: "Промокод ещё не начал действовать" }
      if (message.includes("promo_exhausted")) return { error: "Лимит использований промокода исчерпан" }
      if (message.includes("promo_plan_mismatch")) return { error: "Промокод не действует на этот тариф" }
      return { error: "Не удалось проверить промокод" }
    }
    promo = data as PromoQuote
  }

  // Одна активная заявка на клуб: старые pending отменяем.
  await service.from("platform_billing_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("club_id", club.clubId).eq("status", "pending")

  const { error } = await service.from("platform_billing_requests").insert({
    club_id: club.clubId,
    plan,
    months: normalizedMonths,
    amount: promo?.final_amount ?? baseAmount,
    promo_code_id: promo?.id ?? null,
    promo_code: promo?.code ?? null,
    discount_amount: promo?.discount_amount ?? 0,
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
  communicationLanguage: AppLocale
  workingHours: Record<string, WorkingDay>
}): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "general")) return { error: "Недостаточно прав" }
  if (!data.name.trim()) return { error: "Укажите название клуба" }
  if (!/^\S+@\S+\.\S+$/.test(data.email) && data.email) return { error: "Проверьте email" }
  if (!["Asia/Tashkent", "Asia/Almaty", "Europe/Moscow"].includes(data.timezone)) return { error: "Неизвестный часовой пояс" }
  if (!["UZS", "USD", "RUB"].includes(data.currency)) return { error: "Неизвестная валюта" }
  if (!APP_LOCALES.includes(data.communicationLanguage)) return { error: "Неизвестный язык сообщений" }
  const expectedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  if (Object.keys(data.workingHours).length !== expectedDays.length || expectedDays.some((day) => !data.workingHours[day])) {
    return { error: "Рабочие часы заполнены не полностью" }
  }
  for (const hours of Object.values(data.workingHours)) {
    if (!/^\d{2}:\d{2}$/.test(hours.open) || !/^\d{2}:\d{2}$/.test(hours.close)) {
      return { error: "Проверьте рабочие часы" }
    }
    if (!hours.closed && hours.open >= hours.close) return { error: "Время закрытия должно быть позже времени открытия" }
  }

  const service = createServiceClient()
  const { data: clubRow, error: readError } = await service.from("clubs")
    .select("settings")
    .eq("id", club.clubId)
    .maybeSingle()
  if (readError || !clubRow) return { error: readError?.message ?? "Клуб не найден" }
  const currentSettings = (clubRow?.settings as Record<string, unknown>) ?? {}

  const { data: updated, error } = await service.from("clubs").update({
    name: data.name.trim(),
    settings: {
      ...currentSettings,
      address: data.address.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      website: data.website.trim(),
      timezone: data.timezone,
      currency: data.currency,
      communication_language: data.communicationLanguage,
      working_hours: data.workingHours,
    },
  }).eq("id", club.clubId).select("id").maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: "Настройки не были сохранены" }
  revalidatePath("/", "layout")
  revalidatePath("/settings/club")
  return { ok: true }
}

export async function saveUserLocaleAction(locale: AppLocale): Promise<SaveResult> {
  const normalized = normalizeAppLocale(locale)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const service = createServiceClient()
  const { data: staff, error: staffError } = await service.from("staff")
    .select("id, settings")
    .eq("club_id", club.clubId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()
  if (staffError || !staff) return { error: staffError?.message ?? "Профиль сотрудника не найден" }

  const currentSettings = (staff.settings as Record<string, unknown> | null) ?? {}
  const { data: updated, error } = await service.from("staff")
    .update({ settings: { ...currentSettings, locale: normalized } })
    .eq("id", staff.id)
    .eq("club_id", club.clubId)
    .select("id")
    .maybeSingle()
  if (error) return { error: error.message }
  if (!updated) return { error: "Язык не был сохранён" }
  revalidatePath("/", "layout")
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

export async function inviteStaffAction(data: { email: string; role: string }): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (!can(club.permissions, "staff", "create")) return { error: "Нет прав для приглашения" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }
  if (!(await canInviteRole(club.clubId, club.role, club.permissions, data.role))) {
    return { error: "Нельзя пригласить сотрудника с более широкими правами" }
  }

  const email = data.email.toLowerCase().trim()
  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null),
  ])
  const staffLimitError = requireRecordLimit(club, "staff", (staffCount ?? 0) + (inviteCount ?? 0))
  if (staffLimitError) return { error: staffLimitError }
  const origin = (await headers()).get("origin") ?? ""

  // Delete stale unaccepted email invites for this email+club before creating a new one
  await service.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .eq("email", email)
    .is("accepted_at", null)

  // Store invite in DB (regular client — RLS allows owner/admin insert)
  const { data: invite, error: dbErr } = await service
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email, role: data.role, invited_by: user?.id ?? null })
    .select("id, token")
    .single()

  if (dbErr) return { error: dbErr.message }

  const redirectTo = `${origin}/auth/callback?next=/accept-invite/${invite.token}`
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
        await service.from("staff_invitations").delete().eq("id", invite.id)
        return { error: otpErr.message }
      }
      return { ok: true }
    }
    await service.from("staff_invitations").delete().eq("id", invite.id)
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
  if (!can(club.permissions, "staff", "create")) return { error: "Нет прав для приглашения" }
  if (data.role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }
  if (!(await canInviteRole(club.clubId, club.role, club.permissions, data.role))) {
    return { error: "Нельзя пригласить сотрудника с более широкими правами" }
  }

  const supabase = await createClient()
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null),
  ])
  const staffLimitError = requireRecordLimit(club, "staff", (staffCount ?? 0) + (inviteCount ?? 0))
  if (staffLimitError) return { error: staffLimitError }
  const origin = (await headers()).get("origin") ?? ""

  // Delete all stale unaccepted link invites for this club before creating a fresh one
  await service.from("staff_invitations")
    .delete()
    .eq("club_id", club.clubId)
    .is("email", null)
    .is("accepted_at", null)

  const { data: invite, error } = await service
    .from("staff_invitations")
    .insert({ club_id: club.clubId, email: null, role: data.role, invited_by: user?.id ?? null })
    .select("token")
    .single()

  if (error) return { error: error.message }
  return { url: `${origin}/accept-invite/${invite.token}` }
}

export async function updateStaffRoleAction(staffId: string, role: string): Promise<SaveResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (requirePlanSection(club, "staff")) return { error: "Раздел недоступен на текущем тарифе" }
  if (club.role !== "owner") return { error: "Только владелец может менять роли" }

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
  if (!(club.role === "owner" || can(club.permissions, "staff", "delete"))) return { error: "Нет прав" }

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
    service.from("visits").update({ staff_id: null }).eq("staff_id", staffId).eq("club_id", club.clubId),
    service.from("schedules").update({ staff_id: null }).eq("staff_id", staffId).eq("club_id", club.clubId),
    service.from("classes").update({ staff_id: null }).eq("staff_id", staffId).eq("club_id", club.clubId),
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

  // Филиал входит в подписку текущего клуба и должен сразу получить тот же тариф,
  // иначе create_club оставляет его на отдельном Trial и лимиты расходятся.
  const service = createServiceClient()
  const { data: parentPlan, error: parentPlanError } = await service.from("clubs")
    .select("plan, plan_expires_at, plan_price_locked, plan_currency_locked, plan_period_locked")
    .eq("id", currentClub.clubId).single()
  if (parentPlanError || !parentPlan) {
    await service.from("clubs").delete().eq("id", clubId as string)
    return { error: "Не удалось получить тариф основного клуба" }
  }
  const { error: planError } = await service.from("clubs").update({
    plan: parentPlan.plan,
    trial_expires_at: currentClub.plan === "trial" ? currentClub.trialExpiresAt : null,
    plan_expires_at: parentPlan.plan_expires_at,
    plan_price_locked: parentPlan.plan_price_locked,
    plan_currency_locked: parentPlan.plan_currency_locked,
    plan_period_locked: parentPlan.plan_period_locked,
    plan_assigned_at: new Date().toISOString(),
  }).eq("id", clubId as string)
  if (planError) {
    await service.from("clubs").delete().eq("id", clubId as string)
    return { error: "Не удалось применить тариф к филиалу" }
  }

  revalidatePath("/settings/branches")
  revalidatePath("/")
  return { ok: true, clubId: clubId as string }
}
