"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub, getCurrentClubForRecovery } from "@/lib/club"
import { getPlanByCode } from "@/lib/plans"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { can } from "@/lib/permissions"
import { requireIntegrationSlot, requirePlanFeature, requirePlanSection, requireRecordLimit } from "@/lib/plan-enforcement"
import { APP_LOCALES, normalizeAppLocale, type AppLocale } from "@/lib/app-locale"
import {
  PLAN_CAPACITY_CHECK_ERROR,
  PLAN_CAPACITY_LIMIT_KEYS,
  readPlanCapacityUsage,
  requiresPlanCapacityCheck,
} from "@/lib/plan-capacity"
import { LIMIT_LABELS } from "@/lib/plan-limits"
import { resolvePlatformSubscription } from "@/lib/platform-subscription"

export type SaveResult = { ok?: boolean; error?: string }
export type PromoPreview = {
  code: string
  discountPct: number | null
  freeDays: number
  prices: Record<string, {
    baseAmount: number
    discountAmount: number
    finalAmount: number
  }>
}
export type PromoPreviewResult = { quote?: PromoPreview; error?: string }
type WorkingDay = { open: string; close: string; closed: boolean }
type ClubQuoteSnapshot = {
  plan_id: string | null
  plan: string
  plan_price_locked: number | string | null
  plan_currency_locked: string | null
  plan_period_locked: string | null
  plan_expires_at: string | null
}
type QuoteablePlan = {
  id: string
  code: string
  price: number | string
  currency: string
  period: string
}
type QuoteTerms = {
  unitPrice: number
  currency: string
  period: string
}
type PromoQuote = {
  id: string
  code: string
  discountPct: number | null
  discountAmount: number
  finalAmount: number
  freeDays: number
}

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

function promoErrorMessage(message: string): string {
  if (message.includes("promo_not_found")) return "Промокод не найден"
  if (message.includes("promo_inactive") || message.includes("promo_expired")) return "Промокод больше не действует"
  if (message.includes("promo_not_started")) return "Промокод ещё не начал действовать"
  if (message.includes("promo_exhausted")) return "Лимит использований промокода исчерпан"
  if (message.includes("promo_plan_mismatch")) return "Промокод не действует на доступные тарифы"
  return "Не удалось проверить промокод"
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeBillingMonths(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 12
    ? value
    : null
}

function resolveQuoteTerms(plan: QuoteablePlan, club: ClubQuoteSnapshot): QuoteTerms | null {
  const samePlan = !requiresPlanCapacityCheck(
    { id: club.plan_id, code: club.plan },
    { id: plan.id, code: plan.code },
  )
  const lockedPrice = club.plan_price_locked !== null
  const lockedCurrency = Boolean(club.plan_currency_locked?.trim())
  const lockedPeriod = Boolean(club.plan_period_locked?.trim())
  const hasAnyLockedTerm = lockedPrice || lockedCurrency || lockedPeriod
  const hasCompleteLockedTerms = lockedPrice && lockedCurrency && lockedPeriod
  if (samePlan && hasAnyLockedTerm && !hasCompleteLockedTerms) return null

  const useLockedTerms = samePlan && hasCompleteLockedTerms
  const priceSource = useLockedTerms ? club.plan_price_locked : plan.price
  const unitPrice = roundMoney(Number(priceSource))
  const currency = useLockedTerms ? club.plan_currency_locked!.trim() : plan.currency.trim()
  const period = useLockedTerms ? club.plan_period_locked!.trim() : plan.period.trim()

  // Renewal terms and expiry are expressed in calendar months throughout the
  // current CRM flow. Fail closed instead of misquoting quarterly/yearly plans.
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || !currency || period !== "monthly") return null
  return { unitPrice, currency, period }
}

function parsePromoQuote(value: unknown, baseAmount: number): PromoQuote | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id : ""
  const code = typeof row.code === "string" ? row.code.trim() : ""
  const discountPct = row.discount_pct === null ? null : Number(row.discount_pct)
  const discountAmount = roundMoney(Number(row.discount_amount))
  const finalAmount = roundMoney(Number(row.final_amount))
  const freeDays = Number(row.free_days)
  const expectedFinalAmount = roundMoney(Math.max(0, baseAmount - discountAmount))

  if (!id || !code) return null
  if (discountPct !== null && (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100)) return null
  if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > baseAmount) return null
  if (!Number.isFinite(finalAmount) || finalAmount !== expectedFinalAmount) return null
  if (!Number.isSafeInteger(freeDays) || freeDays < 0 || freeDays > 365) return null

  return { id, code, discountPct, discountAmount, finalAmount, freeDays }
}

async function readClubQuoteSnapshot(
  service: ReturnType<typeof createServiceClient>,
  clubId: string,
): Promise<ClubQuoteSnapshot | null> {
  const { data, error } = await service
    .from("clubs")
    .select("plan_id, plan, plan_price_locked, plan_currency_locked, plan_period_locked, plan_expires_at")
    .eq("id", clubId)
    .maybeSingle()
  if (error || !data) return null
  if (data.plan_id !== null && typeof data.plan_id !== "string") return null
  if (typeof data.plan !== "string" || !data.plan.trim()) return null
  if (data.plan_price_locked !== null && !["number", "string"].includes(typeof data.plan_price_locked)) return null
  if (data.plan_currency_locked !== null && typeof data.plan_currency_locked !== "string") return null
  if (data.plan_period_locked !== null && typeof data.plan_period_locked !== "string") return null
  if (data.plan_expires_at !== null && typeof data.plan_expires_at !== "string") return null
  return data as ClubQuoteSnapshot
}

/** Проверяет промокод и возвращает пересчитанные цены до создания заявки. */
export async function quotePlanPromoAction(promoCode: string, months = 1): Promise<PromoPreviewResult> {
  if (typeof promoCode !== "string") return { error: "Проверьте промокод" }
  const normalizedMonths = normalizeBillingMonths(months)
  if (normalizedMonths === null) return { error: "Выберите срок от 1 до 12 месяцев" }
  const code = promoCode.trim().toUpperCase().slice(0, 32)
  if (!code) return { error: "Введите промокод" }

  const club = await getCurrentClubForRecovery()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }
  const subscription = resolvePlatformSubscription({
    plan: club.plan,
    status: club.status,
    trialExpiresAt: club.trialExpiresAt,
    planExpiresAt: club.planExpiresAt,
  })
  if ((!club.impersonating && club.status !== "active") || !subscription.canRenew) return { error: "Изменение подписки недоступно. Обратитесь в поддержку" }

  const service = createServiceClient()
  const [{ data: plans, error: plansError }, quoteSnapshot] = await Promise.all([
    service
      .from("plans")
      .select("id, code, price, currency, period")
      .eq("is_trial", false)
      .eq("is_archived", false)
      .eq("is_active", true)
      .eq("period", "monthly")
      .order("sort_order"),
    readClubQuoteSnapshot(service, club.clubId),
  ])
  if (plansError) return { error: "Не удалось загрузить тарифы" }
  if (!quoteSnapshot) return { error: "Не удалось проверить условия тарифа" }
  if (!plans?.length) return { error: "Тарифы временно недоступны" }

  const pricedPlans = plans.map((item) => {
    const terms = resolveQuoteTerms(item, quoteSnapshot)
    return terms ? { item, baseAmount: roundMoney(terms.unitPrice * normalizedMonths) } : null
  })
  if (pricedPlans.some((item) => item === null)) return { error: "Не удалось проверить условия тарифа" }

  const results = await Promise.all(pricedPlans.map(async (priced) => {
    const { item, baseAmount } = priced!
    const { data, error } = await service.rpc("platform_quote_promo", {
      p_code: code,
      p_plan: item.code,
      p_months: normalizedMonths,
      p_base_amount: baseAmount,
    })
    return { plan: item.code, baseAmount, data, error }
  }))

  const fatalError = results.find(({ error }) => error && !error.message.includes("promo_plan_mismatch"))?.error
  if (fatalError) return { error: promoErrorMessage(fatalError.message) }

  const parsedResults = results.map((item) => ({
    ...item,
    quote: item.error ? null : parsePromoQuote(item.data, item.baseAmount),
  }))
  if (parsedResults.some((item) => !item.error && !item.quote)) return { error: "Не удалось проверить промокод" }

  const validQuotes = parsedResults.filter((item) => item.quote !== null) as Array<{
    plan: string
    baseAmount: number
    quote: PromoQuote
  }>
  if (!validQuotes.length) return { error: "Промокод не действует на доступные тарифы" }

  const first = validQuotes[0].quote
  const prices = Object.fromEntries(validQuotes.map(({ plan, baseAmount, quote }) => [
    plan,
    {
      baseAmount,
      discountAmount: quote.discountAmount,
      finalAmount: quote.finalAmount,
    },
  ]))

  return {
    quote: {
      code: first.code,
      discountPct: first.discountPct,
      freeDays: first.freeDays,
      prices,
    },
  }
}

/** Заявка клуба на оформление/продление тарифа. Подтверждает админ платформы. */
export async function requestPlanAction(plan: string, months = 1, promoCode?: string): Promise<SaveResult> {
  if (typeof plan !== "string" || !plan.trim()) return { error: "Неизвестный тариф" }
  if (promoCode !== undefined && typeof promoCode !== "string") return { error: "Проверьте промокод" }
  const normalizedMonths = normalizeBillingMonths(months)
  if (normalizedMonths === null) return { error: "Выберите срок от 1 до 12 месяцев" }
  // Цена берётся из БД (раздел «Тарифы» в Platform Admin) — без хардкода.
  const planRow = await getPlanByCode(plan)
  if (!planRow || planRow.is_trial || planRow.is_archived || !planRow.is_active) return { error: "Неизвестный тариф" }
  const supabase = await createClient()
  const club = await getCurrentClubForRecovery()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }
  const subscription = resolvePlatformSubscription({
    plan: club.plan,
    status: club.status,
    trialExpiresAt: club.trialExpiresAt,
    planExpiresAt: club.planExpiresAt,
  })
  if ((!club.impersonating && club.status !== "active") || !subscription.canRenew) return { error: "Изменение подписки недоступно. Обратитесь в поддержку" }

  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient()
  const quoteSnapshot = await readClubQuoteSnapshot(service, club.clubId)
  if (!quoteSnapshot) return { error: "Не удалось проверить условия тарифа" }
  const quoteTerms = resolveQuoteTerms(planRow, quoteSnapshot)
  if (!quoteTerms) return { error: "Не удалось проверить условия тарифа" }
  const samePlan = !requiresPlanCapacityCheck(
    { id: quoteSnapshot.plan_id, code: quoteSnapshot.plan },
    { id: planRow.id, code: planRow.code },
  )
  if (samePlan && quoteSnapshot.plan_expires_at === null) {
    return { error: "Текущий тариф действует бессрочно и не требует продления" }
  }

  // A downgrade must not create a plan that the club already exceeds. The
  // UI explains the blockers, and this trusted server check prevents callers
  // from bypassing it through a direct Server Action request. Same-plan
  // renewal remains available so an existing overage cannot block recovery.
  if (!samePlan) {
    let usage
    try {
      usage = await readPlanCapacityUsage(club.clubId)
    } catch {
      return { error: PLAN_CAPACITY_CHECK_ERROR }
    }

    const blocker = PLAN_CAPACITY_LIMIT_KEYS.find((key) => {
      const used = usage[key]
      const limit = planRow.limits[key]
      return limit != null && used > limit
    })
    if (blocker) {
      const used = usage[blocker]
      return { error: `${LIMIT_LABELS[blocker]}: сейчас ${used.toLocaleString("ru-RU")}, лимит тарифа — ${planRow.limits[blocker]?.toLocaleString("ru-RU")}. Сначала сократите использование.` }
    }
  }

  const baseAmount = roundMoney(quoteTerms.unitPrice * normalizedMonths)
  let promo: PromoQuote | null = null
  const normalizedPromoCode = promoCode?.trim().toUpperCase().slice(0, 32) ?? ""
  if (normalizedPromoCode) {
    const { data, error: promoError } = await service.rpc("platform_quote_promo", {
      p_code: normalizedPromoCode,
      p_plan: plan,
      p_months: normalizedMonths,
      p_base_amount: baseAmount,
    })
    if (promoError) {
      return { error: promoErrorMessage(promoError.message) }
    }
    promo = parsePromoQuote(data, baseAmount)
    if (!promo) return { error: "Не удалось проверить промокод" }
  }

  const amountAfterPromo = promo?.finalAmount ?? baseAmount
  const quotedAt = new Date().toISOString()
  const { data: compensation, error: compensationError } = await service.from("platform_club_compensations")
    .select("id, value")
    .eq("club_id", club.clubId)
    .eq("benefit_type", "discount_pct")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${quotedAt}`)
    .order("value", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (compensationError) return { error: "Не удалось проверить компенсацию клуба" }

  const compensationPct = compensation ? Number(compensation.value) : 0
  if (
    compensation
    && (typeof compensation.id !== "string" || !compensation.id || !Number.isSafeInteger(compensationPct) || compensationPct < 1 || compensationPct > 100)
  ) return { error: "Не удалось проверить компенсацию клуба" }
  const compensationDiscount = roundMoney(amountAfterPromo * compensationPct / 100)
  const finalAmount = roundMoney(Math.max(0, baseAmount - (promo?.discountAmount ?? 0) - compensationDiscount))

  // Replacement is explicit: the owner cancels the visible pending request
  // first. This avoids a cancel-then-insert gap that could lose a valid request
  // when the replacement insert fails.
  const { data: existingRequest, error: existingRequestError } = await service
    .from("platform_billing_requests")
    .select("id")
    .eq("club_id", club.clubId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle()
  if (existingRequestError) return { error: "Не удалось проверить текущую заявку. Повторите попытку" }
  if (existingRequest) return { error: "Сначала отмените текущую заявку на подписку" }

  const { error } = await service.from("platform_billing_requests").insert({
    club_id: club.clubId,
    plan,
    quoted_plan_id: planRow.id,
    months: normalizedMonths,
    amount: finalAmount,
    promo_code_id: promo?.id ?? null,
    promo_code: promo?.code ?? null,
    discount_amount: promo?.discountAmount ?? 0,
    promo_free_days: promo?.freeDays ?? 0,
    compensation_id: compensation?.id ?? null,
    compensation_discount_amount: compensationDiscount,
    quoted_unit_price: quoteTerms.unitPrice,
    quoted_currency: quoteTerms.currency,
    quoted_period: quoteTerms.period,
    quoted_at: quotedAt,
    status: "pending",
    requested_by: user?.id ?? null,
    requested_email: user?.email ?? null,
  })
  if (error?.code === "23505") {
    return { error: "Другая заявка уже отправлена. Обновите страницу и проверьте её статус" }
  }
  if (error) return { error: "Не удалось отправить заявку. Повторите попытку" }

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
  const club = await getCurrentClubForRecovery()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "settings", "subscription")) return { error: "Недостаточно прав" }
  const subscription = resolvePlatformSubscription({
    plan: club.plan,
    status: club.status,
    trialExpiresAt: club.trialExpiresAt,
    planExpiresAt: club.planExpiresAt,
  })
  if ((!club.impersonating && club.status !== "active") || !subscription.canRenew) return { error: "Изменение подписки недоступно. Обратитесь в поддержку" }
  const service = createServiceClient()
  const { data: cancelled, error } = await service.from("platform_billing_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolution_reason: "cancelled_by_club" })
    .eq("club_id", club.clubId).eq("status", "pending")
    .select("id")
    .maybeSingle()
  if (error) return { error: "Не удалось отменить заявку. Попробуйте ещё раз" }
  if (!cancelled) return { error: "Заявка уже обработана" }
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
  const club = await getCurrentClubForRecovery()
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
  const checkedAt = new Date().toISOString()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null).gt("expires_at", checkedAt),
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
  const checkedAt = new Date().toISOString()
  const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("is_active", true),
    service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).is("accepted_at", null).gt("expires_at", checkedAt),
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
  const service = createServiceClient()
  const { data: sourceClub } = await service.from("clubs")
    .select("owner_id").eq("id", currentClub.clubId).maybeSingle()
  if (!sourceClub?.owner_id) return { error: "Не удалось определить владельца сети" }
  const { count: branchCount } = await service.from("clubs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", sourceClub.owner_id).neq("status", "deleted")
  const branchLimitError = requireRecordLimit(currentClub, "branches", branchCount ?? 0)
  if (branchLimitError) return { error: branchLimitError }

  const { data: clubId, error } = await service.rpc("create_branch_for_user", {
    p_user_id: user.id,
    p_source_club_id: currentClub.clubId,
    p_name: data.name.trim(),
    p_city: data.address?.trim() || null,
  })

  if (error) {
    if (error.message.includes("branch_limit_reached")) return { error: branchLimitError ?? "Лимит филиалов исчерпан" }
    if (error.message.includes("platform_subscription_locked")) return { error: "Сначала продлите подписку" }
    if (error.message.includes("branch_feature_unavailable")) return { error: "Филиалы недоступны на текущем тарифе" }
    return { error: "Не удалось создать филиал" }
  }

  revalidatePath("/settings/branches")
  revalidatePath("/")
  return { ok: true, clubId: clubId as string }
}
