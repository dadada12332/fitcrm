import { Bot, InlineKeyboard } from "grammy"
import { formatClubMoney, localeTag, normalizeAppLocale, type AppLocale } from "@/lib/app-locale"
import { createServiceClient } from "@/lib/supabase/service"
import { hourInTimeZone, shiftDateKey, zonedDayRange } from "@/lib/timezone"
import { withPlatformCronRun } from "@/lib/platform-cron"
import { resolveAuthoritativeClubSubscription, type ClubSubscriptionRow } from "@/lib/platform-subscription-server"

type ClubSettings = {
  timezone?: string
  currency?: string
  communication_language?: AppLocale
}

type ReportCopy = {
  title: string
  revenue: string
  comparison: string
  averageCheck: string
  payments: string
  visits: string
  newClients: string
  renewals: string
  attention: string
  expiring: string
  pending: string
  classesToday: string
  quiet: string
  today: string
  cash: string
  clients: string
}

const COPY: Record<AppLocale, ReportCopy> = {
  ru: {
    title: "Итоги дня",
    revenue: "Выручка",
    comparison: "к предыдущему дню",
    averageCheck: "Средний чек",
    payments: "оплат",
    visits: "Посещений",
    newClients: "Новых клиентов",
    renewals: "Оформлено абонементов",
    attention: "Требует внимания",
    expiring: "Истекают в ближайшие 3 дня",
    pending: "Ожидают оплаты",
    classesToday: "Занятий сегодня",
    quiet: "Вчера не было выручки и посещений. Проверьте, все ли операции внесены в CRM.",
    today: "Сегодня",
    cash: "Касса",
    clients: "Клиенты",
  },
  uz: {
    title: "Kun yakunlari",
    revenue: "Tushum",
    comparison: "oldingi kunga nisbatan",
    averageCheck: "O‘rtacha chek",
    payments: "to‘lov",
    visits: "Tashriflar",
    newClients: "Yangi mijozlar",
    renewals: "Rasmiylashtirilgan abonementlar",
    attention: "E’tibor talab qiladi",
    expiring: "Keyingi 3 kunda tugaydi",
    pending: "To‘lov kutilmoqda",
    classesToday: "Bugungi mashg‘ulotlar",
    quiet: "Kecha tushum va tashriflar bo‘lmadi. Barcha operatsiyalar CRM ga kiritilganini tekshiring.",
    today: "Bugun",
    cash: "Kassa",
    clients: "Mijozlar",
  },
  en: {
    title: "Daily results",
    revenue: "Revenue",
    comparison: "vs previous day",
    averageCheck: "Average payment",
    payments: "payments",
    visits: "Visits",
    newClients: "New clients",
    renewals: "Memberships created",
    attention: "Needs attention",
    expiring: "Expire within 3 days",
    pending: "Pending payment",
    classesToday: "Classes today",
    quiet: "There was no revenue or attendance yesterday. Check that all activity was entered into CRM.",
    today: "Today",
    cash: "Cash desk",
    clients: "Clients",
  },
}

function html(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function safeTimeZone(value: unknown) {
  const timeZone = typeof value === "string" ? value : "Asia/Tashkent"
  try {
    hourInTimeZone(new Date(), timeZone)
    return timeZone
  } catch {
    return "Asia/Tashkent"
  }
}

function percentageChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// Runs once at 04:00 UTC (07:00–10:00 for supported club timezones).
// Each report still uses the club's exact local calendar-day boundaries.
// Financial data is delivered only to an active owner linked to that same club.
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  return withPlatformCronRun("telegram_daily_report", async () => {
  const supabase = createServiceClient()
  const now = new Date()
  const [{ data: clubs }, { data: integrations }, { data: recipients }] = await Promise.all([
    supabase.from("clubs").select("id, name, settings, plan, status, trial_expires_at, plan_expires_at, plans(code, is_trial)"),
    supabase.from("telegram_integrations").select("club_id, bot_token"),
    supabase
      .from("telegram_users")
      .select("telegram_id, staff:staff_id(club_id, role,is_active)")
      .not("staff_id", "is", null),
  ])

  if (!clubs?.length) return Response.json({ ok: true, clubs: 0, sent: 0 })

  const tokenByClub = new Map((integrations ?? []).map((item) => [item.club_id, item.bot_token]))
  const ownersByClub = new Map<string, Set<number>>()
  for (const recipient of recipients ?? []) {
    const staff = recipient.staff as unknown as { club_id: string; role: string; is_active: boolean } | null
    if (!staff?.is_active || staff.role !== "owner") continue
    const owners = ownersByClub.get(staff.club_id) ?? new Set<number>()
    owners.add(Number(recipient.telegram_id))
    ownersByClub.set(staff.club_id, owners)
  }

  let sent = 0
  let eligibleClubs = 0

  for (const club of clubs) {
    if (resolveAuthoritativeClubSubscription(club as unknown as ClubSubscriptionRow).isLocked) continue
    const settings = ((club.settings as Record<string, unknown> | null) ?? {}) as ClubSettings
    const timeZone = safeTimeZone(settings.timezone)

    const targets = ownersByClub.get(club.id)
    const token = tokenByClub.get(club.id)
    if (!token || !targets?.size) continue
    eligibleClubs += 1

    const locale = normalizeAppLocale(settings.communication_language)
    const currency = settings.currency ?? "UZS"
    const copy = COPY[locale]
    const reportDay = zonedDayRange(now, timeZone, -1)
    const previousDay = zonedDayRange(now, timeZone, -2)
    const today = zonedDayRange(now, timeZone, 0)
    const expiringThrough = shiftDateKey(today.dateKey, 3)

    const [
      visitsResult,
      paymentsResult,
      previousPaymentsResult,
      newClientsResult,
      renewalsResult,
      expiringResult,
      pendingPaymentsResult,
      classesResult,
    ] = await Promise.all([
      supabase.from("visits").select("id", { count: "exact", head: true })
        .eq("club_id", club.id).gte("checked_in_at", reportDay.from).lt("checked_in_at", reportDay.to),
      supabase.from("payments").select("amount")
        .eq("club_id", club.id).eq("status", "paid").gte("paid_at", reportDay.from).lt("paid_at", reportDay.to),
      supabase.from("payments").select("amount")
        .eq("club_id", club.id).eq("status", "paid").gte("paid_at", previousDay.from).lt("paid_at", previousDay.to),
      supabase.from("clients").select("id", { count: "exact", head: true })
        .eq("club_id", club.id).gte("created_at", reportDay.from).lt("created_at", reportDay.to),
      supabase.from("subscriptions").select("id", { count: "exact", head: true })
        .eq("club_id", club.id).gte("created_at", reportDay.from).lt("created_at", reportDay.to),
      supabase.from("subscriptions").select("id", { count: "exact", head: true })
        .eq("club_id", club.id).eq("status", "active")
        .gte("expires_at", today.dateKey).lte("expires_at", expiringThrough),
      supabase.from("payments").select("amount")
        .eq("club_id", club.id).eq("status", "pending"),
      supabase.from("classes").select("id", { count: "exact", head: true })
        .eq("club_id", club.id).eq("date", today.dateKey).eq("status", "scheduled"),
    ])

    const payments = paymentsResult.data ?? []
    const revenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const previousRevenue = (previousPaymentsResult.data ?? [])
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    const pendingPayments = pendingPaymentsResult.data ?? []
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const averageCheck = payments.length ? revenue / payments.length : 0
    const change = percentageChange(revenue, previousRevenue)
    const sign = change > 0 ? "+" : ""
    const dateLabel = new Intl.DateTimeFormat(localeTag(locale), {
      day: "numeric",
      month: "long",
      weekday: "long",
      timeZone,
    }).format(new Date(reportDay.from))

    let message = `📊 <b>${html(copy.title)} · ${html(dateLabel)}</b>\n`
    message += `🏋️ ${html(club.name)}\n\n`
    message += `💰 <b>${html(copy.revenue)}: ${html(formatClubMoney(revenue, currency, locale))}</b>\n`
    message += `↕️ ${sign}${change}% ${html(copy.comparison)}\n`
    message += `🧾 ${html(copy.averageCheck)}: <b>${html(formatClubMoney(averageCheck, currency, locale))}</b> · ${payments.length} ${html(copy.payments)}\n\n`
    message += `👟 ${html(copy.visits)}: <b>${visitsResult.count ?? 0}</b>\n`
    message += `🆕 ${html(copy.newClients)}: <b>${newClientsResult.count ?? 0}</b>\n`
    message += `🔄 ${html(copy.renewals)}: <b>${renewalsResult.count ?? 0}</b>\n\n`
    message += `⚠️ <b>${html(copy.attention)}</b>\n`
    message += `• ${html(copy.expiring)}: <b>${expiringResult.count ?? 0}</b>\n`
    message += `• ${html(copy.pending)}: <b>${pendingPayments.length}</b> · ${html(formatClubMoney(pendingAmount, currency, locale))}\n`
    message += `• ${html(copy.classesToday)}: <b>${classesResult.count ?? 0}</b>`
    if (revenue === 0 && (visitsResult.count ?? 0) === 0) {
      message += `\n\n💡 ${html(copy.quiet)}`
    }

    const keyboard = new InlineKeyboard()
      .text(`📊 ${copy.today}`, "report_today")
      .text(`💰 ${copy.cash}`, "stat_revenue")
      .text(`👥 ${copy.clients}`, "stat_clients")
    const bot = new Bot(token)

    for (const chatId of targets) {
      const idempotencyKey = `owner_daily:${reportDay.dateKey}:${chatId}`
      const { data: existing } = await supabase.from("telegram_events")
        .select("id, status")
        .eq("club_id", club.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()
      if (existing?.status === "sent") continue

      let eventId = existing?.id as string | undefined
      if (eventId) {
        await supabase.from("telegram_events").update({
          status: "processing",
          error_message: null,
        }).eq("id", eventId).eq("club_id", club.id)
      } else {
        const { data: event } = await supabase.from("telegram_events").insert({
          club_id: club.id,
          telegram_id: chatId,
          event_type: "owner_daily_report",
          status: "processing",
          idempotency_key: idempotencyKey,
          metadata: { report_date: reportDay.dateKey, time_zone: timeZone },
        }).select("id").single()
        eventId = event?.id
      }

      try {
        await bot.api.sendMessage(chatId, message, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        })
        sent += 1
        if (eventId) {
          await supabase.from("telegram_events").update({ status: "sent" })
            .eq("id", eventId).eq("club_id", club.id)
        }
      } catch (error) {
        if (eventId) {
          await supabase.from("telegram_events").update({
            status: "failed",
            error_message: error instanceof Error ? error.message.slice(0, 500) : "Telegram delivery failed",
          }).eq("id", eventId).eq("club_id", club.id)
        }
      }
    }
  }

  return Response.json({ ok: true, clubs: eligibleClubs, sent })
  })
}
