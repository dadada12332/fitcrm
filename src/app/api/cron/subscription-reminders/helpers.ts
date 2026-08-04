import { dateKeyInTimeZone } from "../../../../lib/timezone"
import { localeTag, normalizeAppLocale, type AppLocale } from "../../../../lib/app-locale"

export const SUBSCRIPTION_REMINDER_DAYS = [7, 3, 1, 0] as const

export type SubscriptionReminderMilestone =
  | (typeof SUBSCRIPTION_REMINDER_DAYS)[number]
  | "overdue"

const DEFAULT_TIME_ZONE = "Asia/Tashkent"
const DAY_MS = 86_400_000
export const SUBSCRIPTION_REMINDER_LEASE_MS = 15 * 60 * 1_000

export function resolveReminderClubSubscription(input: {
  legacyPlan: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  relatedPlan: { code: string; is_trial: boolean } | Array<{ code: string; is_trial: boolean }> | null
}): { plan: string; isTrial: boolean; expiresAt: string | null } {
  const related = Array.isArray(input.relatedPlan) ? input.relatedPlan[0] : input.relatedPlan
  const isTrial = related?.is_trial ?? input.legacyPlan === "trial"
  return {
    plan: related?.code ?? input.legacyPlan,
    isTrial,
    expiresAt: isTrial ? input.trialExpiresAt : input.planExpiresAt,
  }
}

type ReminderCopy = {
  overdue: (clubName: string, date: string) => string
  expiredToday: (clubName: string) => string
  lastDay: (clubName: string) => string
  expiresIn: (clubName: string, days: number, date: string) => string
  pending: string
  renew: string
  pendingCta: string
  renewCta: string
}

const COPY: Record<AppLocale, ReminderCopy> = {
  ru: {
    overdue: (clubName, date) => `⛔ Подписка Zalkins для клуба «${clubName}» истекла ${date}. Доступ к CRM ограничен, но данные клуба сохранены.`,
    expiredToday: (clubName) => `⛔ Подписка Zalkins для клуба «${clubName}» истекла сегодня. Доступ к CRM ограничен, но данные клуба сохранены.`,
    lastDay: (clubName) => `⚠️ Сегодня последний день подписки Zalkins для клуба «${clubName}».`,
    expiresIn: (clubName, days, date) => {
      const dayWord = days === 1 ? "день" : days >= 2 && days <= 4 ? "дня" : "дней"
      return `⚠️ Подписка Zalkins для клуба «${clubName}» закончится через ${days} ${dayWord} — ${date}.`
    },
    pending: "Заявка на продление уже обрабатывается. Создавать ещё одну не нужно — статус доступен на странице подписки.",
    renew: "Продлите подписку заранее, чтобы команда продолжила работать без перерыва.",
    pendingCta: "Статус заявки",
    renewCta: "Продлить подписку",
  },
  en: {
    overdue: (clubName, date) => `⛔ The Zalkins subscription for “${clubName}” expired on ${date}. CRM access is restricted, but the club's data is safe.`,
    expiredToday: (clubName) => `⛔ The Zalkins subscription for “${clubName}” expired today. CRM access is restricted, but the club's data is safe.`,
    lastDay: (clubName) => `⚠️ Today is the last day of the Zalkins subscription for “${clubName}”.`,
    expiresIn: (clubName, days, date) => `⚠️ The Zalkins subscription for “${clubName}” expires in ${days} ${days === 1 ? "day" : "days"} — ${date}.`,
    pending: "Your renewal request is already being processed. There is no need to create another one — its status is available on the subscription page.",
    renew: "Renew the subscription in advance so your team can keep working without interruption.",
    pendingCta: "Request status",
    renewCta: "Renew subscription",
  },
  uz: {
    overdue: (clubName, date) => `⛔ “${clubName}” klubi uchun Zalkins obunasi ${date} kuni tugagan. CRM xizmatidan foydalanish cheklangan, ammo klub ma’lumotlari saqlangan.`,
    expiredToday: (clubName) => `⛔ “${clubName}” klubi uchun Zalkins obunasi bugun tugadi. CRM xizmatidan foydalanish cheklangan, ammo klub ma’lumotlari saqlangan.`,
    lastDay: (clubName) => `⚠️ Bugun “${clubName}” klubi uchun Zalkins obunasining so‘nggi kuni.`,
    expiresIn: (clubName, days, date) => `⚠️ “${clubName}” klubi uchun Zalkins obunasi ${days} kundan keyin — ${date} kuni tugaydi.`,
    pending: "Obunani uzaytirish so‘rovi ko‘rib chiqilmoqda. Yangi so‘rov yuborish shart emas — holatini obuna sahifasida ko‘rishingiz mumkin.",
    renew: "Jamoangiz uzluksiz ishlashi uchun obunani oldindan uzaytiring.",
    pendingCta: "So‘rov holati",
    renewCta: "Obunani uzaytirish",
  },
}

export function renderSubscriptionReminder(input: {
  clubName: string
  expiresAt: string
  milestone: SubscriptionReminderMilestone
  timeZone: string
  locale: unknown
  pendingRequest: boolean
  now: Date
}): { message: string; cta: string; locale: AppLocale } {
  const locale = normalizeAppLocale(input.locale)
  const copy = COPY[locale]
  const date = new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: input.timeZone,
  }).format(new Date(input.expiresAt))

  let message: string
  if (input.milestone === "overdue") {
    message = copy.overdue(input.clubName, date)
  } else if (input.milestone === 0) {
    message = new Date(input.expiresAt).getTime() <= input.now.getTime()
      ? copy.expiredToday(input.clubName)
      : copy.lastDay(input.clubName)
  } else {
    message = copy.expiresIn(input.clubName, input.milestone, date)
  }

  return {
    message: `${message}\n\n${input.pendingRequest ? copy.pending : copy.renew}`,
    cta: input.pendingRequest ? copy.pendingCta : copy.renewCta,
    locale,
  }
}

export function canReclaimSubscriptionReminder(
  status: string,
  createdAt: string,
  now: Date,
): boolean {
  if (status === "failed") return true
  if (status !== "processing") return false
  const claimedAt = new Date(createdAt).getTime()
  return Number.isFinite(claimedAt)
    && claimedAt < now.getTime() - SUBSCRIPTION_REMINDER_LEASE_MS
}

export function subscriptionReminderLeaseCutoff(now: Date): string {
  return new Date(now.getTime() - SUBSCRIPTION_REMINDER_LEASE_MS).toISOString()
}

export function safeSubscriptionTimeZone(value: unknown): string {
  const timeZone = typeof value === "string" && value.trim() ? value : DEFAULT_TIME_ZONE
  try {
    dateKeyInTimeZone(new Date(), timeZone)
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function resolveSubscriptionReminderMilestone(
  expiresAt: string | null,
  now: Date,
  timeZone: string,
): SubscriptionReminderMilestone | null {
  if (!expiresAt) return null

  const expiry = new Date(expiresAt)
  if (!Number.isFinite(expiry.getTime())) return null

  const safeTimeZone = safeSubscriptionTimeZone(timeZone)
  const expiryDay = dateKeyInTimeZone(expiry, safeTimeZone)
  const currentDay = dateKeyInTimeZone(now, safeTimeZone)
  const daysUntilExpiry = dateKeyToUtcDay(expiryDay) - dateKeyToUtcDay(currentDay)

  if (daysUntilExpiry < 0) return "overdue"
  return SUBSCRIPTION_REMINDER_DAYS.includes(
    daysUntilExpiry as (typeof SUBSCRIPTION_REMINDER_DAYS)[number],
  )
    ? daysUntilExpiry as (typeof SUBSCRIPTION_REMINDER_DAYS)[number]
    : null
}

export function buildSubscriptionReminderIdempotencyKey(
  expiresAt: string,
  milestone: SubscriptionReminderMilestone,
  telegramId: number,
): string {
  const expiryKey = new Date(expiresAt).toISOString()
  return `platform_subscription:${expiryKey}:${milestone}:${telegramId}`
}

function dateKeyToUtcDay(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}
