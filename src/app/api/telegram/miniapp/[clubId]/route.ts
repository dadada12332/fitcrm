import { createServiceClient } from "@/lib/supabase/service"
import { validateTelegramMiniAppInitData } from "@/lib/telegram/miniapp-auth"
import { buildClickPayUrl, buildPaymePayUrl } from "@/lib/payment-links"

export const dynamic = "force-dynamic"

type MiniAppBody = {
  initData?: string
  action?: "bootstrap" | "book" | "cancel" | "renew" | "preferences"
  classId?: string
  bookingId?: string
  provider?: "payme" | "click"
  preferences?: { expiry_reminders?: boolean; schedule_reminders?: boolean }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function tashkentDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}

function bookingError(code: string) {
  const labels: Record<string, string> = {
    client_not_found: "Клиент не найден",
    class_not_found: "Занятие недоступно",
    class_started: "Занятие уже началось",
    already_booked: "Вы уже записаны",
    no_active_subscription: "Для записи нужен активный абонемент",
    full: "Свободных мест больше нет",
    booking_not_found: "Запись не найдена",
    already_attended: "Посещение уже отмечено",
  }
  return labels[code] ?? "Не удалось изменить запись"
}

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await context.params
  if (!UUID.test(clubId)) return fail("Клуб не найден", 404)

  let body: MiniAppBody
  try {
    body = await request.json() as MiniAppBody
  } catch {
    return fail("Некорректный запрос")
  }

  const service = createServiceClient()
  const { data: integration } = await service.from("telegram_integrations")
    .select("bot_token").eq("club_id", clubId).maybeSingle()
  if (!integration?.bot_token) return fail("Telegram не подключён", 404)

  const auth = validateTelegramMiniAppInitData(body.initData ?? "", integration.bot_token)
  if (!auth) return fail("Откройте кабинет заново через Telegram", 401)

  const { data: link } = await service.from("telegram_users")
    .select("client_id, preferences")
    .eq("club_id", clubId).eq("telegram_id", auth.user.id).eq("role", "client").maybeSingle()
  if (!link?.client_id) return fail("Сначала привяжите номер командой /start в боте", 403)

  const clientId = link.client_id as string
  const action = body.action ?? "bootstrap"

  if (action === "book") {
    if (!body.classId || !UUID.test(body.classId)) return fail("Занятие не найдено")
    const { data, error } = await service.rpc("telegram_book_class", {
      p_club_id: clubId, p_client_id: clientId, p_class_id: body.classId,
    })
    if (error) return fail("Не удалось записаться", 500)
    if (data !== "booked" && data !== "already_booked") return fail(bookingError(String(data)))
    await service.from("telegram_events").insert({
      club_id: clubId, telegram_id: auth.user.id, client_id: clientId,
      event_type: "miniapp_class_booked", status: "received", metadata: { class_id: body.classId },
    })
    return Response.json({ ok: true })
  }

  if (action === "cancel") {
    if (!body.bookingId || !UUID.test(body.bookingId)) return fail("Запись не найдена")
    const { data, error } = await service.rpc("telegram_cancel_class_booking", {
      p_club_id: clubId, p_client_id: clientId, p_booking_id: body.bookingId,
    })
    if (error) return fail("Не удалось отменить запись", 500)
    if (data !== "cancelled") return fail(bookingError(String(data)))
    await service.from("telegram_events").insert({
      club_id: clubId, telegram_id: auth.user.id, client_id: clientId,
      event_type: "miniapp_class_cancelled", status: "received", metadata: { booking_id: body.bookingId },
    })
    return Response.json({ ok: true })
  }

  if (action === "preferences") {
    const preferences = {
      expiry_reminders: body.preferences?.expiry_reminders !== false,
      schedule_reminders: body.preferences?.schedule_reminders !== false,
    }
    const { error } = await service.from("telegram_users").update({ preferences })
      .eq("club_id", clubId).eq("telegram_id", auth.user.id).eq("client_id", clientId)
    if (error) return fail("Не удалось сохранить настройки", 500)
    return Response.json({ ok: true, preferences })
  }

  if (action === "renew") {
    if (body.provider !== "payme" && body.provider !== "click") return fail("Выберите способ оплаты")
    const [{ data: currentSub }, { data: credential }, { data: clubRow }] = await Promise.all([
      service.from("subscriptions").select("membership_id, memberships(name, price)")
        .eq("club_id", clubId).eq("client_id", clientId).not("membership_id", "is", null)
        .order("expires_at", { ascending: false }).limit(1).maybeSingle(),
      service.from("club_payment_credentials").select("provider").eq("club_id", clubId)
        .eq("provider", body.provider).eq("enabled", true).maybeSingle(),
      service.from("clubs").select("settings").eq("id", clubId).maybeSingle(),
    ])
    const membership = currentSub?.memberships as unknown as { name: string; price: number } | null
    if (!currentSub?.membership_id || !membership) return fail("Нет абонемента для продления")
    if (!credential) return fail("Этот способ оплаты не подключён")
    if (Number(membership.price) <= 0) return fail("Стоимость абонемента не настроена")

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000).toISOString()
    let { data: payment } = await service.from("payments").select("id")
      .eq("club_id", clubId).eq("client_id", clientId).eq("provider", body.provider)
      .eq("status", "pending").eq("pending_membership_id", currentSub.membership_id)
      .gte("created_at", fifteenMinutesAgo).order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (!payment) {
      const created = await service.from("payments").insert({
        club_id: clubId, client_id: clientId, pending_membership_id: currentSub.membership_id,
        amount: membership.price, provider: body.provider, status: "pending",
      }).select("id").single()
      if (created.error || !created.data) return fail("Не удалось создать оплату", 500)
      payment = created.data
    }
    const settings = (clubRow?.settings as Record<string, unknown> | null) ?? {}
    const bot = (settings.tg_bot as { username?: string } | undefined) ?? {}
    const returnUrl = bot.username ? `https://t.me/${encodeURIComponent(bot.username)}` : undefined
    const paymentUrl = body.provider === "payme"
      ? await buildPaymePayUrl(clubId, payment.id, Number(membership.price), returnUrl)
      : await buildClickPayUrl(clubId, payment.id, Number(membership.price), returnUrl)
    if (!paymentUrl) return fail("Платёжная ссылка недоступна")
    await service.from("telegram_events").insert({
      club_id: clubId, telegram_id: auth.user.id, client_id: clientId,
      event_type: "miniapp_renewal_link_created", status: "sent",
      metadata: { payment_id: payment.id, provider: body.provider },
    })
    return Response.json({ ok: true, paymentUrl })
  }

  const today = tashkentDate()
  const rangeEnd = tashkentDate(7)
  const [{ data: club }, { data: client }, { data: subscriptions }, { data: visits }, { data: classes }, { data: providers }] = await Promise.all([
    service.from("clubs").select("name, city, settings").eq("id", clubId).single(),
    service.from("clients").select("id, full_name, qr_token").eq("id", clientId).eq("club_id", clubId).single(),
    service.from("subscriptions").select("id, status, starts_at, expires_at, visits_total, visits_used, memberships(name, price)")
      .eq("club_id", clubId).eq("client_id", clientId).order("expires_at", { ascending: false }).limit(5),
    service.from("visits").select("id, checked_in_at, method").eq("club_id", clubId).eq("client_id", clientId)
      .order("checked_in_at", { ascending: false }).limit(8),
    service.from("classes").select("id, title, trainer_name, date, start_time, end_time, seats_total, status, rooms(name), class_bookings(id, client_id, status)")
      .eq("club_id", clubId).eq("status", "scheduled").gte("date", today).lte("date", rangeEnd)
      .order("date", { ascending: true }).order("start_time", { ascending: true }).limit(80),
    service.from("club_payment_credentials").select("provider").eq("club_id", clubId).eq("enabled", true).in("provider", ["payme", "click"]),
  ])
  if (!club || !client) return fail("Профиль не найден", 404)

  const rootSettings = (club.settings as Record<string, unknown> | null) ?? {}
  const tgSettings = (rootSettings.tg_settings as { qr_checkin?: boolean } | undefined) ?? {}
  let qrToken = client.qr_token as string | null
  if (!qrToken && tgSettings.qr_checkin !== false) {
    qrToken = crypto.randomUUID()
    await service.from("clients").update({ qr_token: qrToken }).eq("id", clientId).eq("club_id", clubId)
  }
  const classRows = (classes ?? []).map((item) => {
    const bookings = (item.class_bookings as unknown as Array<{ id: string; client_id: string; status: string }>) ?? []
    const activeBookings = bookings.filter((booking) => booking.status === "booked" || booking.status === "attended")
    const mine = activeBookings.find((booking) => booking.client_id === clientId)
    const room = item.rooms as unknown as { name: string } | null
    return {
      id: item.id, title: item.title ?? "Занятие", trainerName: item.trainer_name,
      date: item.date, startTime: item.start_time, endTime: item.end_time,
      roomName: room?.name ?? null, seatsTotal: item.seats_total,
      seatsBooked: activeBookings.length, bookingId: mine?.id ?? null,
    }
  })

  await service.from("telegram_events").insert({
    club_id: clubId, telegram_id: auth.user.id, client_id: clientId,
    event_type: "miniapp_opened", status: "received", metadata: { platform: "web_app" },
  })

  return Response.json({
    club: { name: club.name, city: club.city },
    client: { fullName: client.full_name, telegramFirstName: auth.user.first_name },
    subscriptions: subscriptions ?? [], visits: visits ?? [], classes: classRows,
    qrToken: tgSettings.qr_checkin === false ? null : qrToken,
    preferences: link.preferences ?? { expiry_reminders: true, schedule_reminders: true },
    providers: (providers ?? []).map((item) => item.provider),
    serverDate: today,
  }, { headers: { "Cache-Control": "no-store" } })
}
