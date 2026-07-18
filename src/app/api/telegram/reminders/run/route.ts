import { Bot, InlineKeyboard } from "grammy"
import { createServiceClient } from "@/lib/supabase/service"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"

export const runtime = "nodejs"

function dateInTashkent(daysFromToday: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + daysFromToday))
  return date.toISOString().slice(0, 10)
}

function renderTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  )
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: integrations, error: integrationsError } = await supabase
    .from("telegram_integrations")
    .select("club_id, bot_token")
  if (integrationsError) return Response.json({ error: "Could not load Telegram integrations" }, { status: 500 })
  const tokenByClub = new Map((integrations ?? []).map((item) => [item.club_id, item.bot_token]))
  const clubIds = [...tokenByClub.keys()]
  if (!clubIds.length) return Response.json({ ok: true, sent: 0, failed: 0, skipped: 0 })

  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id, name, settings")
    .in("id", clubIds)

  if (clubsError) return Response.json({ error: "Could not load Telegram integrations" }, { status: 500 })

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const club of clubs ?? []) {
    const clubSettings = (club.settings as Record<string, unknown> | null) ?? {}
    const settings: TelegramSettings = {
      ...DEFAULT_TG_SETTINGS,
      ...((clubSettings.tg_settings as Partial<TelegramSettings> | undefined) ?? {}),
    }
    const reminderDays = [
      settings.auto_expiry_3d ? 3 : null,
      settings.auto_expiry_1d ? 1 : null,
    ].filter((value): value is number => value !== null)
    const subscriptions = reminderDays.length
      ? (await supabase
          .from("subscriptions")
          .select("id, client_id, expires_at, clients(full_name)")
          .eq("club_id", club.id)
          .eq("status", "active")
          .in("expires_at", reminderDays.map(dateInTashkent))).data ?? []
      : []

    const clientIds = [...new Set(subscriptions.map((sub) => sub.client_id))]

    const links = clientIds.length
      ? (await supabase
          .from("telegram_users")
          .select("telegram_id, client_id, preferences")
          .eq("club_id", club.id)
          .in("client_id", clientIds)).data ?? []
      : []
    const linkByClient = new Map((links ?? []).map((link) => [link.client_id, link]))
    const token = tokenByClub.get(club.id)
    if (!token) continue
    const bot = new Bot(token)

    for (const subscription of subscriptions) {
      const link = linkByClient.get(subscription.client_id)
      if (!link || (link.preferences as Record<string, boolean> | null)?.expiry_reminders === false) {
        skipped++
        continue
      }
      const days = reminderDays.find((value) => dateInTashkent(value) === subscription.expires_at)
      if (!days) continue

      const idempotencyKey = `expiry:${subscription.id}:${days}:${subscription.expires_at}`
      const { data: event, error: claimError } = await supabase.from("telegram_events").insert({
        club_id: club.id,
        telegram_id: link.telegram_id,
        client_id: subscription.client_id,
        event_type: "subscription_expiry_reminder",
        status: "processing",
        idempotency_key: idempotencyKey,
        metadata: { days, subscription_id: subscription.id },
      }).select("id").single()
      if (claimError || !event) {
        skipped++
        continue
      }

      const client = subscription.clients as unknown as { full_name: string } | null
      const firstName = client?.full_name?.split(" ")[0] ?? "Клиент"
      const message = renderTemplate(settings.expiry_template, {
        name: firstName,
        club: club.name,
        days,
        expires: new Date(`${subscription.expires_at}T00:00:00+05:00`).toLocaleDateString("ru-RU"),
      })

      try {
        await bot.api.sendMessage(link.telegram_id, message, settings.renewal_reminder
          ? { reply_markup: new InlineKeyboard().text("Открыть абонемент", "sub") }
          : {})
        await supabase.from("telegram_events").update({ status: "sent" }).eq("id", event.id).eq("club_id", club.id)
        sent++
      } catch (error) {
        await supabase.from("telegram_events").update({
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Telegram delivery failed",
        }).eq("id", event.id).eq("club_id", club.id)
        failed++
      }
    }

    const today = dateInTashkent(0)
    const bookings = settings.class_reminders
      ? (await supabase
          .from("class_bookings")
          .select("client_id, classes!inner(id, date, start_time, status, schedules(title), rooms(name))")
          .eq("club_id", club.id)
          .eq("status", "booked")
          .eq("classes.date", today)
          .eq("classes.status", "scheduled")).data ?? []
      : []

    type BookedClass = {
      id: string
      start_time: string
      schedules: { title?: string } | null
      rooms: { name?: string } | null
    }
    const bookingsByClient = new Map<string, BookedClass[]>()
    for (const booking of bookings) {
      const list = bookingsByClient.get(booking.client_id) ?? []
      list.push(booking.classes as unknown as BookedClass)
      bookingsByClient.set(booking.client_id, list)
    }

    if (bookingsByClient.size) {
      const bookingClientIds = [...bookingsByClient.keys()]
      const { data: scheduleLinks } = await supabase.from("telegram_users")
        .select("telegram_id, client_id, preferences")
        .eq("club_id", club.id).in("client_id", bookingClientIds)
      const scheduleLinkByClient = new Map((scheduleLinks ?? []).map((link) => [link.client_id, link]))

      for (const [clientId, classes] of bookingsByClient) {
        const link = scheduleLinkByClient.get(clientId)
        if (!link || (link.preferences as Record<string, boolean> | null)?.schedule_reminders === false) {
          skipped++
          continue
        }
        const idempotencyKey = `schedule:${clientId}:${today}`
        const { data: event, error: claimError } = await supabase.from("telegram_events").insert({
          club_id: club.id, telegram_id: link.telegram_id, client_id: clientId,
          event_type: "class_schedule_reminder", status: "processing", idempotency_key: idempotencyKey,
          metadata: { date: today, classes: classes.length },
        }).select("id").single()
        if (claimError || !event) { skipped++; continue }

        let message = `📅 Ваши занятия сегодня в «${club.name}»:\n\n`
        for (const classItem of classes) {
          const schedule = classItem.schedules as { title?: string } | null
          const room = classItem.rooms as { name?: string } | null
          message += `• ${String(classItem.start_time).slice(0, 5)} — ${schedule?.title ?? "Занятие"}${room?.name ? `, ${room.name}` : ""}\n`
        }
        try {
          await bot.api.sendMessage(link.telegram_id, message, {
            reply_markup: new InlineKeyboard().text("Расписание клуба", "client_schedule"),
          })
          await supabase.from("telegram_events").update({ status: "sent" }).eq("id", event.id).eq("club_id", club.id)
          sent++
        } catch (error) {
          await supabase.from("telegram_events").update({
            status: "failed",
            error_message: error instanceof Error ? error.message.slice(0, 500) : "Telegram delivery failed",
          }).eq("id", event.id).eq("club_id", club.id)
          failed++
        }
      }
    }
  }

  return Response.json({ ok: true, sent, failed, skipped })
}
