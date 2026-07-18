"use server"

import { can } from "@/lib/permissions"
import { sanitizeSearchTerm } from "@/lib/search"
import { getCurrentClub } from "@/lib/club"
import { createServiceClient } from "@/lib/supabase/service"

const MODEL = "gemini-2.5-flash"
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU")
type SB = ReturnType<typeof createServiceClient>

// ── Типы ответа (рендерятся компонентами на фронте) ──────────────
export type AiSource = { entity: string; count: number; period?: string }
export type AiClientItem = { id: string; name: string; line1?: string; line2?: string; phone?: string | null; right?: string }
export type AiListItem = { title: string; subtitle?: string; badge?: string; badgeTone?: "danger" }
export type AiCard =
  | { type: "kpi"; title: string; value: string; delta?: string; deltaUp?: boolean; sub?: string; source?: AiSource; followups?: string[] }
  | { type: "client_list"; title: string; clients: AiClientItem[]; source?: AiSource; followups?: string[]; openHref?: string }
  | { type: "table"; title: string; columns: string[]; rows: string[][]; source?: AiSource; followups?: string[]; openHref?: string }
  | { type: "list"; title: string; items: AiListItem[]; source?: AiSource; followups?: string[]; openHref?: string }
  | { type: "success"; text: string; followups?: string[] }
  | { type: "info"; text: string }

export type AiRole = "user" | "assistant"
export type AiMessage = { role: AiRole; content: string; image?: string | null; cards?: AiCard[] }

// ── Периоды ──────────────────────────────────────────────────────
function periodRange(period?: string): { from: Date; to: Date; label: string } {
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case "yesterday": return { from: new Date(dayStart.getTime() - 86_400_000), to: dayStart, label: "вчера" }
    case "week":      return { from: new Date(dayStart.getTime() - 7 * 86_400_000), to: now, label: "за 7 дней" }
    case "month":     return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: "за месяц" }
    case "today":
    default:          return { from: dayStart, to: now, label: "сегодня" }
  }
}

// ── Дневной брифинг (детерминированный, без LLM) ─────────────────
export type BriefingStat = {
  key: "visits" | "payments" | "expiring" | "revenue"
  label: string
  value: string
  query: string
}
export type Briefing = { greeting: string; date: string; stats: BriefingStat[] }

export async function getBriefingAction(): Promise<Briefing | null> {
  const club = await getCurrentClub()
  if (!club) return null
  if (!can(club.permissions, "ai", "use")) return null
  const s = createServiceClient()
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yStart = new Date(dayStart.getTime() - 86_400_000)
  const in3 = new Date(dayStart.getTime() + 3 * 86_400_000).toISOString().slice(0, 10)
  const today = dayStart.toISOString().slice(0, 10)

  const [visitsToday, payToday, payYest, expiring] = await Promise.all([
    s.from("visits").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).gte("checked_in_at", dayStart.toISOString()),
    s.from("payments").select("amount").eq("club_id", club.clubId).eq("status", "paid").gte("paid_at", dayStart.toISOString()),
    s.from("payments").select("amount").eq("club_id", club.clubId).eq("status", "paid").gte("paid_at", yStart.toISOString()).lt("paid_at", dayStart.toISOString()),
    s.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", club.clubId).eq("status", "active").gte("expires_at", today).lte("expires_at", in3),
  ])
  const rToday = (payToday.data ?? []).reduce((a, p) => a + Number(p.amount), 0)
  const rYest = (payYest.data ?? []).reduce((a, p) => a + Number(p.amount), 0)
  const delta = rYest > 0 ? Math.round(((rToday - rYest) / rYest) * 100) : 0
  const hour = now.getHours()
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер"

  return {
    greeting,
    date: now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }),
    stats: [
      { key: "visits", label: "Посещения сегодня", value: String(visitsToday.count ?? 0), query: "кто сегодня приходил" },
      { key: "payments", label: "Оплаты сегодня", value: String(payToday.data?.length ?? 0), query: "последние оплаты" },
      { key: "expiring", label: "Истекают за 3 дня", value: String(expiring.count ?? 0), query: "у кого заканчивается абонемент" },
      { key: "revenue", label: "Выручка сегодня", value: `${fmt(rToday)}${delta ? (delta > 0 ? ` +${delta}%` : ` -${Math.abs(delta)}%`) : ""}`, query: "какая выручка сегодня" },
    ],
  }
}

// ── Инструменты (декларации) ─────────────────────────────────────
const num = (d: string) => ({ type: "number", description: d })
const str = (d: string) => ({ type: "string", description: d })
const period = { type: "string", description: "Период: today|yesterday|week|month", enum: ["today", "yesterday", "week", "month"] }

const TOOLS = [{
  functionDeclarations: [
    { name: "get_metrics", description: "Выручка, число оплат, средний чек, новые клиенты и посещения за период.", parameters: { type: "object", properties: { period } } },
    { name: "get_in_gym_now", description: "Сколько клиентов сейчас в зале (за последние 2 часа).", parameters: { type: "object", properties: {} } },
    { name: "find_clients", description: "Найти клиентов по имени/телефону: абонемент, остаток, долг.", parameters: { type: "object", properties: { query: str("имя или телефон") }, required: ["query"] } },
    { name: "get_debtors", description: "Клиенты с задолженностью и сумма долга.", parameters: { type: "object", properties: {} } },
    { name: "get_expiring_subscriptions", description: "Абонементы, истекающие в ближайшие N дней.", parameters: { type: "object", properties: { days: num("дней (по умолч. 7)") } } },
    { name: "get_inactive_clients", description: "Клиенты, не приходившие N+ дней.", parameters: { type: "object", properties: { days: num("дней (по умолч. 14)") } } },
    { name: "list_products", description: "Товары: цена и остаток. Фильтр по названию/категории.", parameters: { type: "object", properties: { query: str("фильтр") } } },
    { name: "get_top_products", description: "Самые продаваемые товары за период.", parameters: { type: "object", properties: { period } } },
    { name: "get_low_stock", description: "Товары с низким остатком.", parameters: { type: "object", properties: {} } },
    { name: "get_recent_payments", description: "Последние оплаты (таблица).", parameters: { type: "object", properties: {} } },
    { name: "get_staff", description: "Сотрудники клуба с ролями.", parameters: { type: "object", properties: {} } },
  ],
}]

async function findClients(s: SB, clubId: string, query: string) {
  const q = query.trim()
  const { data } = await s.from("clients").select("id, full_name, phone, debt")
    .eq("club_id", clubId).or(`full_name.ilike.%${sanitizeSearchTerm(q)}%,phone.ilike.%${sanitizeSearchTerm(q)}%`).limit(6)
  return data ?? []
}

// ── Исполнители: возвращают {summary (для LLM), card? (для UI)} ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function execTool(clubId: string, name: string, args: any): Promise<{ summary: string; card?: AiCard }> {
  const s = createServiceClient()
  const A = args ?? {}
  switch (name) {
    case "get_metrics": {
      const { from, to, label } = periodRange(A.period)
      const [pay, newCl, vis] = await Promise.all([
        s.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid").gte("paid_at", from.toISOString()).lt("paid_at", to.toISOString()),
        s.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("created_at", from.toISOString()).lt("created_at", to.toISOString()),
        s.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", from.toISOString()).lt("checked_in_at", to.toISOString()),
      ])
      const sum = (pay.data ?? []).reduce((a, p) => a + Number(p.amount), 0)
      const cnt = pay.data?.length ?? 0
      const avg = cnt ? Math.round(sum / cnt) : 0
      const summary = `Выручка ${label}: ${fmt(sum)} сум, оплат ${cnt}, средний чек ${fmt(avg)}, новых клиентов ${newCl.count ?? 0}, посещений ${vis.count ?? 0}.`
      return { summary, card: { type: "kpi", title: `Выручка ${label}`, value: `${fmt(sum)} сум`, sub: `оплат ${cnt} · средний чек ${fmt(avg)} сум`, source: { entity: "оплаты", count: cnt, period: label }, followups: ["Сравнить с прошлым периодом", "Лучшие продажи", "Открыть отчёт"] } }
    }
    case "get_in_gym_now": {
      const { count } = await s.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", new Date(Date.now() - 2 * 3600_000).toISOString())
      return { summary: `Сейчас в зале: ${count ?? 0}.`, card: { type: "kpi", title: "Сейчас в зале", value: String(count ?? 0), sub: "отметились за последние 2 часа", source: { entity: "посещения", count: count ?? 0, period: "сейчас" }, followups: ["Кто сегодня приходил", "Посещаемость за неделю"] } }
    }
    case "find_clients":
    case "get_debtors":
    case "get_inactive_clients": {
      let clients: AiClientItem[] = []
      let title = "Клиенты"; let src: AiSource = { entity: "клиенты", count: 0 }
      if (name === "find_clients") {
        const rows = await findClients(s, clubId, String(A.query ?? ""))
        title = `Найдено: «${A.query}»`
        const ids = rows.map((c) => c.id)
        const { data: subs } = ids.length ? await s.from("subscriptions").select("client_id, expires_at, visits_total, visits_used, memberships(name)").eq("club_id", clubId).in("client_id", ids).eq("status", "active") : { data: [] }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byC = new Map<string, any>(); for (const sub of subs ?? []) if (!byC.has(sub.client_id)) byC.set(sub.client_id, sub)
        clients = rows.map((c) => {
          const sub = byC.get(c.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mn = Array.isArray((sub as any)?.memberships) ? (sub as any).memberships[0]?.name : (sub as any)?.memberships?.name
          return { id: c.id, name: c.full_name, phone: c.phone, line1: sub ? `${mn} · до ${sub.expires_at}` : "нет активного абонемента", right: Number(c.debt) > 0 ? `долг ${fmt(Number(c.debt))}` : undefined }
        })
        src = { entity: "клиенты", count: clients.length }
      } else if (name === "get_debtors") {
        const { data } = await s.from("clients").select("id, full_name, phone, debt").eq("club_id", clubId).gt("debt", 0).order("debt", { ascending: false }).limit(20)
        title = "Должники"
        clients = (data ?? []).map((c) => ({ id: c.id, name: c.full_name, phone: c.phone, line1: "есть задолженность", right: `${fmt(Number(c.debt))} сум` }))
        const total = (data ?? []).reduce((a, c) => a + Number(c.debt), 0)
        src = { entity: "клиенты", count: clients.length }
        return { summary: `Должников ${clients.length}, всего ${fmt(total)} сум.`, card: { type: "client_list", title: `${title} · ${fmt(total)} сум`, clients, source: src, openHref: "/clients", followups: ["Напомнить всем", "Экспорт"] } }
      } else {
        const days = Number(A.days) || 14
        const since = new Date(Date.now() - days * 86_400_000).toISOString()
        const { data: recent } = await s.from("visits").select("client_id").eq("club_id", clubId).gte("checked_in_at", since).limit(5000)
        const activeSet = new Set((recent ?? []).map((v) => v.client_id))
        const { data: cls } = await s.from("clients").select("id, full_name, phone").eq("club_id", clubId).limit(1000)
        const inactive = (cls ?? []).filter((c) => !activeSet.has(c.id)).slice(0, 20)
        title = `Не приходили ${days}+ дней`
        clients = inactive.map((c) => ({ id: c.id, name: c.full_name, phone: c.phone, line1: "риск оттока" }))
        src = { entity: "клиенты", count: clients.length }
      }
      const names = clients.map((c) => c.name).slice(0, 8).join(", ")
      return { summary: `${title}: ${clients.length}. ${names}`, card: { type: "client_list", title, clients, source: src, openHref: "/clients", followups: name === "find_clients" ? ["Продлить абонемент", "Записать оплату"] : ["Напомнить всем"] } }
    }
    case "get_expiring_subscriptions": {
      const days = Number(A.days) || 7
      const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await s.from("subscriptions").select("expires_at, client_id, clients(id, full_name, phone), memberships(name)").eq("club_id", clubId).eq("status", "active").gte("expires_at", today).lte("expires_at", until).order("expires_at").limit(30)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clients: AiClientItem[] = (data ?? []).map((r: any) => { const c = Array.isArray(r.clients) ? r.clients[0] : r.clients; const mn = Array.isArray(r.memberships) ? r.memberships[0]?.name : r.memberships?.name; return { id: c?.id, name: c?.full_name ?? "?", phone: c?.phone, line1: mn, right: `до ${r.expires_at}` } })
      return { summary: `Истекает за ${days} дн.: ${clients.length}.`, card: { type: "client_list", title: `Истекает за ${days} дн.`, clients, source: { entity: "абонементы", count: clients.length, period: `${days} дн.` }, openHref: "/clients", followups: ["Напомнить всем", "Продлить"] } }
    }
    case "list_products":
    case "get_low_stock": {
      let items: AiListItem[] = []; let title = "Товары"
      if (name === "list_products") {
        let qb = s.from("products").select("name, sell_price, inventory(quantity)").eq("club_id", clubId).eq("is_active", true)
        if (A.query) qb = qb.or(`name.ilike.%${sanitizeSearchTerm(A.query)}%,category.ilike.%${sanitizeSearchTerm(A.query)}%`)
        const { data } = await qb.limit(40)
        title = A.query ? `Товары: «${A.query}»` : "Товары"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items = (data ?? []).map((p: any) => { const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory; return { title: p.name, subtitle: `${fmt(Number(p.sell_price))} сум`, badge: `${Number(inv?.quantity ?? 0)} шт` } })
      } else {
        const { data } = await s.from("products").select("name, inventory(quantity, min_quantity)").eq("club_id", clubId).eq("is_active", true).limit(200)
        title = "Заканчиваются"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items = (data ?? []).map((p: any) => { const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory; return { name: p.name, q: Number(inv?.quantity ?? 0), m: Number(inv?.min_quantity ?? 0) } })
          .filter((p: { q: number; m: number }) => p.m > 0 && p.q <= p.m)
          .map((p: { name: string; q: number; m: number }) => ({ title: p.name, subtitle: `мин. ${p.m}`, badge: `${p.q} шт`, badgeTone: "danger" as const }))
      }
      return { summary: `${title}: ${items.length}.`, card: { type: "list", title, items, source: { entity: "склад", count: items.length }, openHref: "/warehouse", followups: name === "get_low_stock" ? ["Оформить поставку"] : ["Топ продаж"] } }
    }
    case "get_top_products": {
      const { from, label } = { ...periodRange(A.period ?? "month"), label: periodRange(A.period ?? "month").label }
      const { data } = await s.rpc("product_sales_counts", { p_club_id: clubId, p_since: from.toISOString() })
      const ids = (data ?? []).map((r: { product_id: string }) => r.product_id)
      const { data: prods } = ids.length ? await s.from("products").select("id, name").eq("club_id", clubId).in("id", ids) : { data: [] }
      const nm = new Map((prods ?? []).map((p) => [p.id, p.name]))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).sort((a: any, b: any) => b.cnt - a.cnt).slice(0, 10).map((r: any, i: number) => [String(i + 1), nm.get(r.product_id) ?? "?", `${r.cnt}`, `${fmt(Number(r.qty))}`])
      return { summary: `Топ продаж ${label}: ${rows.length} позиций.`, card: { type: "table", title: `Топ продаж ${label}`, columns: ["#", "Товар", "Продаж", "Шт"], rows, source: { entity: "продажи", count: rows.length, period: label }, openHref: "/warehouse" } }
    }
    case "get_recent_payments": {
      const { data } = await s.from("payments").select("amount, provider, paid_at, clients(full_name)").eq("club_id", clubId).eq("status", "paid").order("paid_at", { ascending: false }).limit(15)
      const PL: Record<string, string> = { cash: "Наличные", card: "Карта", click: "Click", payme: "Payme", uzum: "Uzum", transfer: "Перевод", other: "Другое" }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).map((p: any) => [Array.isArray(p.clients) ? p.clients[0]?.full_name : p.clients?.full_name ?? "—", `${fmt(Number(p.amount))}`, PL[p.provider] ?? p.provider, p.paid_at ? new Date(p.paid_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"])
      return { summary: `Последних оплат: ${rows.length}.`, card: { type: "table", title: "Последние оплаты", columns: ["Клиент", "Сумма", "Метод", "Когда"], rows, source: { entity: "оплаты", count: rows.length }, openHref: "/payments" } }
    }
    case "get_staff": {
      const { data } = await s.from("staff").select("role, users(full_name, email)").eq("club_id", clubId).eq("is_active", true)
      const RL: Record<string, string> = { owner: "Владелец", manager: "Менеджер", admin: "Администратор", trainer: "Тренер" }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: AiListItem[] = (data ?? []).map((r: any) => ({ title: r.users?.full_name ?? r.users?.email ?? "?", badge: RL[r.role] ?? r.role }))
      return { summary: `Сотрудников: ${items.length}.`, card: { type: "list", title: "Сотрудники", items, source: { entity: "сотрудники", count: items.length }, openHref: "/staff" } }
    }
    default:
      return { summary: `Неизвестная функция: ${name}` }
  }
}

function resolveDirectIntent(input: string): { name: string; args: Record<string, string | number> } | null {
  const query = input.trim().toLocaleLowerCase("ru-RU")
  if (!query) return null

  if (/последн.*оплат|оплат.*последн/.test(query)) return { name: "get_recent_payments", args: {} }
  if (/должник|долг/.test(query)) return { name: "get_debtors", args: {} }
  if (/низк.*остат|заканчива.*склад|что заканчивается/.test(query)) return { name: "get_low_stock", args: {} }
  if (/истека|заканчива.*абонем|продлен/.test(query)) {
    const days = Number(query.match(/\d+/)?.[0] ?? 7)
    return { name: "get_expiring_subscriptions", args: { days } }
  }
  if (/сейчас.*зал|зал.*сейчас/.test(query)) return { name: "get_in_gym_now", args: {} }
  if (/сотрудник|персонал|команд/.test(query)) return { name: "get_staff", args: {} }
  if (/топ.*продаж|лучш.*продаж/.test(query)) {
    const period = /недел|7\s*дн/.test(query) ? "week" : /сегодня/.test(query) ? "today" : "month"
    return { name: "get_top_products", args: { period } }
  }
  if (/выруч|средн.*чек|сколько.*оплат|посещаемост|кто сегодня приходил/.test(query)) {
    const period = /вчера/.test(query) ? "yesterday" : /недел|7\s*дн/.test(query) ? "week" : /месяц|30\s*дн/.test(query) ? "month" : "today"
    return { name: "get_metrics", args: { period } }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseImage(dataUrl?: string | null): any | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(key: string, body: any): Promise<any> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  return res.json()
}

export async function askAiAction(messages: AiMessage[]): Promise<{ reply: string; cards: AiCard[]; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { reply: "", cards: [], error: "Не авторизован" }
  if (!can(club.permissions, "ai", "use")) return { reply: "", cards: [], error: "Недостаточно прав" }

  const latest = [...messages].reverse().find((message) => message.role === "user")
  const directIntent = latest && !latest.image ? resolveDirectIntent(latest.content) : null
  if (directIntent) {
    const { summary, card } = await execTool(club.clubId, directIntent.name, directIntent.args)
    return { reply: summary, cards: card ? [card] : [] }
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return { reply: "", cards: [], error: "ИИ не подключён (нет ключа)" }

  const systemInstruction = {
    parts: [{
      text:
        `Ты — ассистент FitCRM для клуба «${club.clubName}». Сегодня ${new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}. ` +
        `Отвечай очень кратко (1-2 предложения) на русском — детали покажет карточка. Валюта — сум. ` +
        `Для любых данных/действий вызывай функции, не выдумывай цифры. Если для действия не хватает данных — уточни.`,
    }],
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = messages.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = []
      if (m.content) parts.push({ text: m.content })
      const img = parseImage(m.image)
      if (img && m.role === "user") parts.push(img)
      if (!parts.length) parts.push({ text: "" })
      return { role: m.role === "assistant" ? "model" : "user", parts }
    })

    const cards: AiCard[] = []
    for (let step = 0; step < 6; step++) {
      const resp = await callGemini(key, { systemInstruction, contents, tools: TOOLS, generationConfig: { temperature: 0.3 } })
      if (resp.error) {
        if (resp.error.code === 429) return { reply: "", cards, error: "Слишком много запросов к ИИ — подождите минуту." }
        return { reply: "", cards, error: resp.error.message || "Ошибка Gemini" }
      }
      const parts = resp.candidates?.[0]?.content?.parts ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall)
      if (!calls.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = parts.map((p: any) => p.text).filter(Boolean).join("") || (cards.length ? "" : "Не удалось получить ответ.")
        return { reply: text, cards }
      }
      contents.push({ role: "model", parts })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseParts: any[] = []
      for (const fc of calls) {
        const { summary, card } = await execTool(club.clubId, fc.name, fc.args)
        if (card) cards.push(card)
        responseParts.push({ functionResponse: { name: fc.name, response: { result: summary } } })
      }
      contents.push({ role: "user", parts: responseParts })
    }
    return { reply: "", cards }
  } catch (e) {
    return { reply: "", cards: [], error: e instanceof Error ? e.message : "Ошибка запроса к ИИ" }
  }
}
