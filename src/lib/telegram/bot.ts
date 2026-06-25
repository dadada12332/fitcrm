import { Bot, InlineKeyboard, Keyboard, InputFile } from "grammy"
import { createServiceClient } from "@/lib/supabase/service"

// ── Lazy bot instance ─────────────────────────────────────────────

let _bot: Bot | null = null

export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_CRM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_CRM_BOT_TOKEN is not configured")
    _bot = new Bot(token)
    setupHandlers(_bot)
  }
  return _bot
}

// ── Types ─────────────────────────────────────────────────────────

type UserRole = "client" | "owner" | "manager" | "admin" | "trainer"

interface TgUser {
  telegram_id: number
  client_id: string | null
  staff_id: string | null
  role: UserRole
  pending_action: string | null
  client?: { id: string; full_name: string; qr_token: string | null; club_id: string }
  staff?: { id: string; role: string; club_id: string; settings: Record<string, any> }
}

// ── Helpers ───────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("998") && digits.length === 12) return digits.slice(3)
  if (digits.startsWith("7")   && digits.length === 11) return digits.slice(1)
  if (digits.startsWith("8")   && digits.length === 11) return digits.slice(1)
  return digits
}

function fmtMoney(n: number) { return n.toLocaleString("ru-RU") }

function todayRange() {
  const now     = new Date()
  const from    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const to      = new Date(from.getTime() + 86_400_000)
  return { from: from.toISOString(), to: to.toISOString() }
}

function yesterdayRange() {
  const now       = new Date()
  const todayUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterday = new Date(todayUTC.getTime() - 86_400_000)
  return { from: yesterday.toISOString(), to: todayUTC.toISOString() }
}

async function getLinkedUser(telegramId: number): Promise<TgUser | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("telegram_users")
    .select("telegram_id, client_id, staff_id, role, pending_action, clients(id, full_name, qr_token, club_id), staff(id, role, club_id, settings)")
    .eq("telegram_id", telegramId)
    .maybeSingle()
  if (!data) return null
  return {
    telegram_id:    data.telegram_id,
    client_id:      data.client_id,
    staff_id:       data.staff_id,
    role:           (data.role ?? "client") as UserRole,
    pending_action: data.pending_action,
    client:         (data.clients as any) ?? undefined,
    staff:          (data.staff as any) ?? undefined,
  }
}

async function setPendingAction(telegramId: number, action: string | null) {
  const supabase = createServiceClient()
  await supabase
    .from("telegram_users")
    .update({ pending_action: action })
    .eq("telegram_id", telegramId)
}

// ── Keyboards ─────────────────────────────────────────────────────

function clientMenu() {
  return new InlineKeyboard()
    .text("🏋️ Мой абонемент", "sub")
    .text("📊 История", "history")
    .row()
    .text("📱 QR-код", "qr")
    .text("📞 Контакты", "contacts")
}

function ownerMenu() {
  return new InlineKeyboard()
    .text("📊 Отчёт сегодня", "report_today")
    .text("📅 Отчёт вчера", "report_yesterday")
    .row()
    .text("👥 Клиенты", "stat_clients")
    .text("💰 Касса", "stat_revenue")
    .row()
    .text("🔔 Уведомления", "notify_menu")
    .text("🤖 Спросить AI", "ask_ai")
}

function adminMenu() {
  return new InlineKeyboard()
    .text("👤 Найти клиента",       "find_client")
    .text("✅ Отметить посещение",  "mark_visit")
    .row()
    .text("📅 Расписание сегодня", "today_schedule")
    .text("📊 Отчёт дня",          "report_today")
}

function trainerMenu() {
  return new InlineKeyboard()
    .text("📅 Мои занятия сегодня", "trainer_schedule")
    .text("👥 Мои клиенты",         "trainer_clients")
    .row()
    .text("✅ Отметить посещение",  "mark_visit")
}

function backBtn(cb = "staff_menu") {
  return new InlineKeyboard().text("⬅️ Назад", cb)
}

async function sendMenuForUser(ctx: any, tgUser: TgUser) {
  const role = tgUser.role
  if (role === "client") {
    const name = tgUser.client?.full_name?.split(" ")[0] ?? "друг"
    await ctx.reply(`👋 Привет, *${name}*!\n\nВыберите раздел:`, {
      reply_markup: clientMenu(), parse_mode: "Markdown",
    })
  } else if (role === "owner" || role === "manager") {
    const name = tgUser.staff?.settings?.full_name?.split(" ")[0] ?? "шеф"
    await ctx.reply(`👋 Привет, *${name}*! 🏆\n\nПанель управления клубом:`, {
      reply_markup: ownerMenu(), parse_mode: "Markdown",
    })
  } else if (role === "admin") {
    await ctx.reply(`👋 Привет, Администратор!\n\nБыстрые действия:`, {
      reply_markup: adminMenu(), parse_mode: "Markdown",
    })
  } else if (role === "trainer") {
    await ctx.reply(`👋 Привет! 💪\n\nВаш рабочий стол:`, {
      reply_markup: trainerMenu(), parse_mode: "Markdown",
    })
  }
}

// ── Report builder ────────────────────────────────────────────────

async function buildReport(clubId: string, from: string, to: string, label: string) {
  const supabase = createServiceClient()

  const [visitsRes, paymentsRes, newClientsRes, renewalsRes] = await Promise.all([
    supabase.from("visits").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("checked_in_at", from).lt("checked_in_at", to),
    supabase.from("payments").select("amount")
      .eq("club_id", clubId).eq("status", "paid").gte("paid_at", from).lt("paid_at", to),
    supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("created_at", from).lt("created_at", to),
    supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("created_at", from).lt("created_at", to),
  ])

  const visits     = visitsRes.count ?? 0
  const revenue    = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const newClients = newClientsRes.count ?? 0
  const renewals   = renewalsRes.count ?? 0

  let text = `📊 *${label}*\n\n`
  text += `💰 Выручка: *${fmtMoney(revenue)} сум*\n`
  text += `👟 Посещений: *${visits}*\n`
  text += `🆕 Новых клиентов: *${newClients}*\n`
  text += `🔄 Продлений: *${renewals}*`
  if (revenue === 0 && visits === 0) text += `\n\n⚠️ Активности не было.`
  return text
}

// ── AI Analytics ──────────────────────────────────────────────────

async function askAI(clubId: string, question: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return "❌ AI аналитика не настроена. Добавьте ANTHROPIC_API_KEY."

  const supabase = createServiceClient()
  const { from, to }        = yesterdayRange()
  const { from: weekAgo }   = { from: new Date(Date.now() - 7 * 86_400_000).toISOString() }

  const [visits7, payments7, expiring, inactive] = await Promise.all([
    supabase.from("visits").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("checked_in_at", weekAgo),
    supabase.from("payments").select("amount")
      .eq("club_id", clubId).eq("status", "paid").gte("paid_at", weekAgo),
    supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).eq("status", "active").lte("expires_at", new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)),
    supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("club_id", clubId),
  ])

  const revenue7   = (payments7.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const visits7cnt = visits7.count ?? 0
  const expCnt     = expiring.count ?? 0
  const totalCli   = inactive.count ?? 0

  const context = `Данные фитнес-клуба за последние 7 дней:
- Посещений: ${visits7cnt}
- Выручка: ${fmtMoney(revenue7)} сум
- Истекающих абонементов (≤5 дней): ${expCnt}
- Всего клиентов: ${totalCli}`

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `${context}\n\nВопрос владельца клуба: ${question}\n\nОтвечай кратко, по-русски, с конкретными числами из данных.`,
        },
      ],
    }),
  })

  const data = await resp.json()
  return data?.content?.[0]?.text ?? "Не смог получить ответ от AI."
}

// ── Handler setup ─────────────────────────────────────────────────

function setupHandlers(bot: Bot) {

  // /start, /menu ──────────────────────────────────────────────────
  bot.command(["start", "menu"], async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const tgUser = await getLinkedUser(telegramId)
    if (tgUser) {
      await sendMenuForUser(ctx, tgUser)
      return
    }

    const kb = new Keyboard().requestContact("📱 Поделиться номером").resized()
    await ctx.reply(
      "👋 Добро пожаловать в *FitCRM*!\n\nНажмите кнопку ниже чтобы войти в систему:",
      { reply_markup: kb, parse_mode: "Markdown" }
    )
  })

  // /sub — абонемент напрямую ───────────────────────────────────────
  bot.command("sub", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    const tgUser = await getLinkedUser(telegramId)
    if (!tgUser?.client_id) { await ctx.reply("Сначала войдите: /start"); return }
    // simulate callback
    const supabase = createServiceClient()
    const { data: subs } = await supabase
      .from("subscriptions").select("*, memberships(name, visits_limit)")
      .eq("client_id", tgUser.client_id).in("status", ["active", "frozen"])
      .order("expires_at", { ascending: false }).limit(1)
    const sub = subs?.[0]
    if (!sub) { await ctx.reply("❌ Нет активного абонемента."); return }
    const mem      = sub.memberships as any
    const expires  = sub.expires_at ? new Date(sub.expires_at) : null
    const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000) : null
    const visitsLeft = sub.visits_total ? sub.visits_total - sub.visits_used : null
    let text = `🏋️ *Ваш абонемент*\n\nТип: *${mem?.name ?? "Стандарт"}*\n`
    text += sub.status === "active" ? "Статус: ✅ Активен\n" : "Статус: ❄️ Заморожен\n"
    if (expires) text += `До: *${expires.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}*\n`
    if (daysLeft !== null) text += `Осталось: *${daysLeft} дн.*\n`
    text += visitsLeft !== null ? `Посещений: *${visitsLeft} из ${sub.visits_total}*` : `Посещений: *безлимит*`
    if (daysLeft !== null && daysLeft <= 5) text += `\n\n⚠️ *Скоро заканчивается!*`
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: new InlineKeyboard().text("⬅️ Меню", "menu") })
  })

  // /qr — QR-код напрямую ───────────────────────────────────────────
  bot.command("qr", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    const tgUser = await getLinkedUser(telegramId)
    if (!tgUser?.client_id) { await ctx.reply("Сначала войдите: /start"); return }
    const supabase = createServiceClient()
    let qrToken = tgUser.client?.qr_token as string | null
    if (!qrToken) {
      qrToken = crypto.randomUUID()
      await supabase.from("clients").update({ qr_token: qrToken }).eq("id", tgUser.client_id)
    }
    try {
      const QRCode   = (await import("qrcode")).default
      const qrBuffer = await QRCode.toBuffer(qrToken, { width: 400, margin: 2, color: { dark: "#020617", light: "#ffffff" } })
      await ctx.replyWithPhoto(new InputFile(qrBuffer, "qr.png"), {
        caption: "📱 *Ваш QR-код*\n\nПокажите на входе.", parse_mode: "Markdown",
      })
    } catch { await ctx.reply("❌ Ошибка генерации QR.") }
  })

  // /help ───────────────────────────────────────────────────────────
  bot.command("help", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    const tgUser = await getLinkedUser(telegramId)
    const isLinked = !!tgUser

    let text = `❓ *Помощь*\n\n`
    if (!isLinked) {
      text += `Вы ещё не вошли в систему.\n\nНажмите /start и поделитесь номером телефона.`
    } else {
      text += `*Доступные команды:*\n`
      text += `/start — главное меню\n`
      text += `/menu — открыть меню\n`
      if (tgUser.role === "client") {
        text += `/sub — мой абонемент\n`
        text += `/qr — мой QR-код\n`
      }
      text += `\n💬 По вопросам обращайтесь к администратору клуба.`
    }
    await ctx.reply(text, { parse_mode: "Markdown" })
  })

  // Contact shared ──────────────────────────────────────────────────
  bot.on("message:contact", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const phone      = ctx.message.contact?.phone_number ?? ""
    const normalized = normalizePhone(phone)
    if (!normalized) return

    const supabase = createServiceClient()
    const removeKb = { reply_markup: { remove_keyboard: true } as any }

    // 1. Staff first — staff members always take priority over clients
    const { data: staffList } = await supabase
      .from("staff")
      .select("id, role, club_id, settings, is_active")
      .eq("is_active", true)

    const matchedStaff = (staffList ?? []).find((s: any) => {
      const staffPhone = normalizePhone(s.settings?.phone ?? "")
      return staffPhone && staffPhone === normalized
    })

    if (matchedStaff) {
      const { error: upsertErr } = await supabase.from("telegram_users").upsert(
        { telegram_id: telegramId, staff_id: matchedStaff.id, role: matchedStaff.role },
        { onConflict: "telegram_id" }
      )
      if (upsertErr) {
        await ctx.reply(`❌ Ошибка привязки: ${upsertErr.message}`, removeKb)
        return
      }
      const roleName: Record<string, string> = {
        owner: "Владелец", manager: "Менеджер", admin: "Администратор", trainer: "Тренер",
      }
      await ctx.reply(
        `✅ Вход выполнен!\nРоль: *${roleName[matchedStaff.role] ?? matchedStaff.role}*`,
        { ...removeKb, parse_mode: "Markdown" } as any
      )
      const tgUser = await getLinkedUser(telegramId)
      if (tgUser) await sendMenuForUser(ctx, tgUser)
      return
    }

    // 2. Then check clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, phone, qr_token")
      .ilike("phone", `%${normalized}%`)
      .limit(1)

    if (clients?.length) {
      const client = clients[0]
      const { error: upsertErr } = await supabase.from("telegram_users").upsert(
        { telegram_id: telegramId, client_id: client.id, role: "client" },
        { onConflict: "telegram_id" }
      )
      if (upsertErr) {
        await ctx.reply(`❌ Ошибка привязки: ${upsertErr.message}`, removeKb)
        return
      }
      await supabase.from("clients").update({ telegram_id: telegramId }).eq("id", client.id)
      const firstName = client.full_name.split(" ")[0]
      await ctx.reply(`✅ Добро пожаловать, *${firstName}*!`, { ...removeKb, parse_mode: "Markdown" } as any)
      const tgUser = await getLinkedUser(telegramId)
      if (tgUser) await sendMenuForUser(ctx, tgUser)
      return
    }

    await ctx.reply(
      "❌ Номер не найден в системе.\n\nОбратитесь к администратору клуба.",
      removeKb
    )
  })

  // Text messages (search queries etc.) ────────────────────────────
  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const tgUser = await getLinkedUser(telegramId)

    // Handle pending actions (multi-step flows)
    if (tgUser?.pending_action === "searching_client") {
      await setPendingAction(telegramId, null)
      const query    = ctx.message.text?.trim() ?? ""
      const supabase = createServiceClient()
      const clubId   = tgUser.staff?.club_id
      if (!clubId) return

      const { data: found } = await supabase
        .from("clients")
        .select("id, full_name, phone")
        .eq("club_id", clubId)
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5)

      if (!found?.length) {
        await ctx.reply("🔍 Клиентов не найдено.", {
          reply_markup: backBtn("staff_menu"),
        })
        return
      }

      const kb = new InlineKeyboard()
      for (const c of found) {
        kb.text(`${c.full_name} ${c.phone ? `(${c.phone})` : ""}`, `client_info:${c.id}`).row()
      }
      kb.text("⬅️ Назад", "staff_menu")

      await ctx.reply(`🔍 Найдено: ${found.length}`, { reply_markup: kb })
      return
    }

    if (tgUser?.pending_action === "asking_ai") {
      await setPendingAction(telegramId, null)
      const question = ctx.message.text?.trim() ?? ""
      const clubId   = tgUser.staff?.club_id ?? ""
      await ctx.reply("🤖 Анализирую данные...")
      const answer = await askAI(clubId, question)
      await ctx.reply(answer, {
        reply_markup: new InlineKeyboard().text("⬅️ Назад", "staff_menu"),
        parse_mode: "Markdown",
      })
      return
    }

    // Default
    if (tgUser) {
      await sendMenuForUser(ctx, tgUser)
    } else {
      const kb = new Keyboard().requestContact("📱 Поделиться номером").resized()
      await ctx.reply("Для входа поделитесь номером:", { reply_markup: kb })
    }
  })

  // Callback queries ────────────────────────────────────────────────
  bot.on("callback_query:data", async (ctx) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const data   = ctx.callbackQuery.data
    const tgUser = await getLinkedUser(telegramId)

    if (!tgUser) {
      await ctx.answerCallbackQuery("Сначала войдите через /start")
      return
    }

    await ctx.answerCallbackQuery()

    const supabase = createServiceClient()
    const role     = tgUser.role
    const isStaff  = role !== "client"
    const clubId   = isStaff ? (tgUser.staff?.club_id ?? "") : ""

    // ── Универсальные ──────────────────────────────────────────────

    if (data === "menu") {
      await ctx.editMessageText(
        role === "client"
          ? `👋 Привет, *${tgUser.client?.full_name?.split(" ")[0] ?? "друг"}*!\n\nВыберите раздел:`
          : `👋 Главное меню:`,
        { reply_markup: role === "client" ? clientMenu() : role === "admin" ? adminMenu() : role === "trainer" ? trainerMenu() : ownerMenu(), parse_mode: "Markdown" }
      )
      return
    }

    if (data === "staff_menu") {
      await ctx.editMessageText("👋 Главное меню:", {
        reply_markup: role === "admin" ? adminMenu() : role === "trainer" ? trainerMenu() : ownerMenu(),
        parse_mode: "Markdown",
      })
      return
    }

    // ── CLIENT callbacks ───────────────────────────────────────────

    if (role === "client") {
      const clientId  = tgUser.client_id!
      const firstName = tgUser.client?.full_name?.split(" ")[0] ?? "друг"
      const back      = new InlineKeyboard().text("⬅️ Назад", "menu")

      if (data === "sub") {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("*, memberships(name, visits_limit)")
          .eq("client_id", clientId)
          .in("status", ["active", "frozen"])
          .order("expires_at", { ascending: false })
          .limit(1)

        const sub = subs?.[0]
        if (!sub) {
          await ctx.editMessageText("❌ *Нет активного абонемента*\n\nОбратитесь к администратору.", { reply_markup: back, parse_mode: "Markdown" })
          return
        }

        const mem      = sub.memberships as any
        const expires  = sub.expires_at ? new Date(sub.expires_at) : null
        const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000) : null
        const visitsLeft = sub.visits_total ? sub.visits_total - sub.visits_used : null

        let text = `🏋️ *Ваш абонемент*\n\n`
        text += `Тип: *${mem?.name ?? "Стандарт"}*\n`
        text += `Статус: ${sub.status === "active" ? "✅ Активен" : "❄️ Заморожен"}\n`
        if (expires)     text += `До: *${expires.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}*\n`
        if (daysLeft !== null) text += `Осталось: *${daysLeft} дн.*\n`
        text += visitsLeft !== null ? `Посещений: *${visitsLeft} из ${sub.visits_total}*` : `Посещений: *безлимит*`
        if (daysLeft !== null && daysLeft <= 5) text += `\n\n⚠️ *Абонемент скоро заканчивается!*`

        await ctx.editMessageText(text, { reply_markup: back, parse_mode: "Markdown" })
        return
      }

      if (data === "history") {
        const { data: visits } = await supabase
          .from("visits").select("checked_in_at").eq("client_id", clientId)
          .order("checked_in_at", { ascending: false }).limit(10)

        if (!visits?.length) {
          await ctx.editMessageText("📊 *История посещений*\n\nПосещений пока нет.", { reply_markup: back, parse_mode: "Markdown" })
          return
        }
        let text = `📊 *Последние посещения*\n\n`
        for (const v of visits) {
          const d = new Date(v.checked_in_at)
          text += `📅 ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}\n`
        }
        await ctx.editMessageText(text, { reply_markup: back, parse_mode: "Markdown" })
        return
      }

      if (data === "qr") {
        let qrToken = tgUser.client?.qr_token as string | null
        if (!qrToken) {
          qrToken = crypto.randomUUID()
          await supabase.from("clients").update({ qr_token: qrToken }).eq("id", clientId)
        }
        try {
          const QRCode   = (await import("qrcode")).default
          const qrBuffer = await QRCode.toBuffer(qrToken, { width: 400, margin: 2, color: { dark: "#020617", light: "#ffffff" } })
          await ctx.replyWithPhoto(new InputFile(qrBuffer, "qr.png"), {
            caption: `📱 *Ваш QR-код*\n\nПокажите на входе.`, parse_mode: "Markdown",
          })
        } catch { await ctx.reply("❌ Ошибка генерации QR.") }
        return
      }

      if (data === "contacts") {
        const { data: clubData } = await supabase.from("clubs").select("name, city, settings").eq("id", tgUser.client!.club_id).single()
        const s    = (clubData?.settings as any) ?? {}
        let text   = `📞 *Контакты клуба*\n\n🏋️ *${clubData?.name ?? "Клуб"}*\n`
        if (clubData?.city) text += `📍 ${clubData.city}\n`
        if (s.phone)        text += `📞 ${s.phone}\n`
        if (s.instagram)    text += `📸 @${s.instagram}\n`
        if (s.address)      text += `🗺 ${s.address}\n`
        if (!s.phone && !s.instagram && !s.address) text += `\nСвяжитесь с администратором клуба.`
        await ctx.editMessageText(text, { reply_markup: back, parse_mode: "Markdown" })
        return
      }
    }

    // ── STAFF/OWNER callbacks ──────────────────────────────────────

    if (!isStaff) return

    if (data === "report_today") {
      const { from, to } = todayRange()
      const now = new Date()
      const label = `Отчёт за сегодня (${now.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })})`
      const text  = await buildReport(clubId, from, to, label)
      await ctx.editMessageText(text, { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "report_yesterday") {
      const { from, to } = yesterdayRange()
      const yesterday = new Date(Date.now() - 86_400_000)
      const label = `Отчёт за вчера (${yesterday.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })})`
      const text  = await buildReport(clubId, from, to, label)
      await ctx.editMessageText(text, { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "stat_clients") {
      const [totalRes, activeSubsRes, expiringRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active")
          .lte("expires_at", new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)),
      ])
      let text  = `👥 *Клиенты*\n\n`
      text += `Всего клиентов: *${totalRes.count ?? 0}*\n`
      text += `Активных абонементов: *${activeSubsRes.count ?? 0}*\n`
      text += `⚠️ Истекает через 7 дней: *${expiringRes.count ?? 0}*`
      await ctx.editMessageText(text, { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "stat_revenue") {
      const { from, to }       = todayRange()
      const { from: monthFrom } = { from: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString() }

      const [todayRes, monthRes] = await Promise.all([
        supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid").gte("paid_at", from).lt("paid_at", to),
        supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid").gte("paid_at", monthFrom),
      ])

      const todayRev = (todayRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
      const monthRev = (monthRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)

      let text  = `💰 *Касса*\n\n`
      text += `Сегодня: *${fmtMoney(todayRev)} сум*\n`
      text += `Месяц:   *${fmtMoney(monthRev)} сум*`
      await ctx.editMessageText(text, { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "notify_menu") {
      const { data: expiring } = await supabase
        .from("subscriptions")
        .select("client_id, expires_at, clients(full_name, telegram_id)")
        .eq("club_id", clubId)
        .eq("status", "active")
        .lte("expires_at", new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10))
        .order("expires_at")
        .limit(10)

      if (!expiring?.length) {
        await ctx.editMessageText("🔔 *Уведомления*\n\nНет клиентов с истекающими абонементами.", { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
        return
      }

      const kb = new InlineKeyboard()
        .text(`📨 Напомнить всем ${expiring.length} клиентам`, `notify_all`)
        .row()
        .text("⬅️ Назад", "staff_menu")

      let text = `🔔 *Истекающие абонементы*\n\n`
      for (const s of expiring) {
        const c       = (s as any).clients
        const exp     = new Date(s.expires_at!)
        const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
        text += `• ${c?.full_name ?? "?"} — *${daysLeft} дн.*\n`
      }
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "Markdown" })
      return
    }

    if (data === "notify_all") {
      const { data: expiring } = await supabase
        .from("subscriptions")
        .select("client_id, expires_at, clients(full_name, telegram_id)")
        .eq("club_id", clubId)
        .eq("status", "active")
        .lte("expires_at", new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10))

      let sent = 0
      for (const s of expiring ?? []) {
        const c       = (s as any).clients
        const tgId    = c?.telegram_id
        if (!tgId) continue
        const exp     = new Date(s.expires_at!)
        const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
        try {
          await getBot().api.sendMessage(tgId, `⚠️ *Ваш абонемент заканчивается через ${daysLeft} дн.*\n\nОбратитесь к администратору для продления.`, { parse_mode: "Markdown" })
          sent++
        } catch { /* user may have blocked bot */ }
      }
      await ctx.editMessageText(`✅ Отправлено уведомлений: *${sent}*`, { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "ask_ai") {
      await setPendingAction(telegramId, "asking_ai")
      await ctx.editMessageText("🤖 *AI Аналитик*\n\nНапишите ваш вопрос:\n\nНапример: _«Почему упала выручка?»_ или _«Кто давно не приходил?»_", {
        reply_markup: backBtn("staff_menu"),
        parse_mode: "Markdown",
      })
      return
    }

    if (data === "find_client") {
      await setPendingAction(telegramId, "searching_client")
      await ctx.editMessageText("🔍 *Поиск клиента*\n\nНапишите имя или номер телефона:", {
        reply_markup: backBtn("staff_menu"),
        parse_mode: "Markdown",
      })
      return
    }

    if (data.startsWith("client_info:")) {
      const clientId = data.split(":")[1]
      const [clientRes, subRes, visitRes] = await Promise.all([
        supabase.from("clients").select("full_name, phone, created_at").eq("id", clientId).single(),
        supabase.from("subscriptions").select("*, memberships(name)").eq("client_id", clientId).eq("status", "active").limit(1),
        supabase.from("visits").select("checked_in_at").eq("client_id", clientId).order("checked_in_at", { ascending: false }).limit(1),
      ])

      const c   = clientRes.data
      const sub = subRes.data?.[0]
      const v   = visitRes.data?.[0]

      let text  = `👤 *${c?.full_name ?? "?"}*\n\n`
      if (c?.phone) text += `📞 ${c.phone}\n`
      if (sub) {
        const mem  = (sub.memberships as any)
        const exp  = sub.expires_at ? new Date(sub.expires_at) : null
        const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null
        text += `🏋️ Абонемент: *${mem?.name ?? "—"}*\n`
        if (days !== null) text += `Осталось: *${days} дн.*\n`
      } else {
        text += `❌ Нет активного абонемента\n`
      }
      if (v) {
        const d = new Date(v.checked_in_at)
        text += `Последний визит: *${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}*`
      }

      const kb = new InlineKeyboard()
        .text("✅ Отметить посещение", `do_visit:${clientId}`)
        .row()
        .text("⬅️ Назад", "find_client")

      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "Markdown" })
      return
    }

    if (data === "mark_visit") {
      await setPendingAction(telegramId, "searching_client")
      await ctx.editMessageText("✅ *Отметить посещение*\n\nНайдите клиента — введите имя или телефон:", {
        reply_markup: backBtn("staff_menu"),
        parse_mode: "Markdown",
      })
      return
    }

    if (data.startsWith("do_visit:")) {
      const clientId = data.split(":")[1]
      const { data: activeSub } = await supabase
        .from("subscriptions").select("id, visits_used, visits_total")
        .eq("client_id", clientId).eq("status", "active").limit(1).maybeSingle()

      await supabase.from("visits").insert({
        club_id:         clubId,
        client_id:       clientId,
        subscription_id: activeSub?.id ?? null,
        method:          "telegram",
      })

      if (activeSub?.visits_total) {
        await supabase.from("subscriptions")
          .update({ visits_used: (activeSub.visits_used ?? 0) + 1 })
          .eq("id", activeSub.id)
      }

      await ctx.editMessageText("✅ *Посещение отмечено!*", { reply_markup: backBtn("staff_menu"), parse_mode: "Markdown" })
      return
    }

    if (data === "today_schedule" || data === "trainer_schedule") {
      const dayOfWeek = new Date().getDay()
      const { data: schedules } = await supabase
        .from("schedules")
        .select("title, start_time, end_time, rooms(name)")
        .eq("club_id", clubId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .order("start_time")

      const back = backBtn("staff_menu")
      if (!schedules?.length) {
        await ctx.editMessageText("📅 На сегодня занятий нет.", { reply_markup: back, parse_mode: "Markdown" })
        return
      }

      let text = `📅 *Расписание на сегодня*\n\n`
      for (const s of schedules) {
        const room = (s.rooms as any)?.name ?? ""
        text += `🕐 ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} *${s.title}*${room ? ` (${room})` : ""}\n`
      }
      await ctx.editMessageText(text, { reply_markup: back, parse_mode: "Markdown" })
      return
    }

    if (data === "trainer_clients") {
      const staffId = tgUser.staff_id
      const { data: visits } = await supabase
        .from("visits")
        .select("client_id, clients(full_name)")
        .eq("club_id", clubId)
        .eq("staff_id", staffId)
        .order("checked_in_at", { ascending: false })

      const unique = new Map<string, string>()
      for (const v of visits ?? []) {
        if (!unique.has(v.client_id)) unique.set(v.client_id, (v.clients as any)?.full_name ?? v.client_id)
      }

      const back = backBtn("staff_menu")
      if (!unique.size) {
        await ctx.editMessageText("👥 У вас пока нет клиентов.", { reply_markup: back, parse_mode: "Markdown" })
        return
      }

      let text = `👥 *Мои клиенты (${unique.size})*\n\n`
      for (const name of unique.values()) text += `• ${name}\n`
      await ctx.editMessageText(text, { reply_markup: back, parse_mode: "Markdown" })
      return
    }
  })
}
