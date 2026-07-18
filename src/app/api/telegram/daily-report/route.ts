import { Bot } from "grammy"
import { createServiceClient } from "@/lib/supabase/service"

// Vercel Cron 04:00 UTC = 09:00 Ташкент. vercel.json: "0 4 * * *".
// Отчёт КАЖДОГО клуба уходит только владельцам/админам ЭТОГО клуба, через бота
// этого клуба (service-only telegram_integrations). Никакого глобального чата — иначе один человек
// получал бы статистику всех клубов (утечка мультитенантности).
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Вчера (UTC)
  const now       = new Date()
  const todayUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterday = new Date(todayUTC.getTime() - 86_400_000)
  const from      = yesterday.toISOString()
  const to        = todayUTC.toISOString()
  const dateStr   = yesterday.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })

  const { data: clubs } = await supabase.from("clubs").select("id, name")
  if (!clubs?.length) return Response.json({ ok: true, clubs: 0 })
  const { data: integrations } = await supabase.from("telegram_integrations").select("club_id, bot_token")
  const tokenByClub = new Map((integrations ?? []).map((item) => [item.club_id, item.bot_token]))

  // Получатели отчёта = owner/admin клуба, привязавшие свой telegram
  const { data: recipsRaw } = await supabase
    .from("telegram_users")
    .select("telegram_id, staff:staff_id(club_id, role)")
    .not("staff_id", "is", null)

  const byClub = new Map<string, number[]>()
  for (const r of recipsRaw ?? []) {
    const s = r.staff as unknown as { club_id: string; role: string } | null
    if (!s || !["owner", "admin"].includes(s.role)) continue
    const arr = byClub.get(s.club_id) ?? []
    arr.push(r.telegram_id as number)
    byClub.set(s.club_id, arr)
  }

  let sent = 0

  for (const club of clubs) {
    const targets = byClub.get(club.id)
    const token = tokenByClub.get(club.id)
    if (!token || !targets?.length) continue

    const [visitsRes, paymentsRes, newClientsRes, renewalsRes] = await Promise.all([
      supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", club.id).gte("checked_in_at", from).lt("checked_in_at", to),
      supabase.from("payments").select("amount").eq("club_id", club.id).eq("status", "paid").gte("paid_at", from).lt("paid_at", to),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", club.id).gte("created_at", from).lt("created_at", to),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", club.id).gte("created_at", from).lt("created_at", to),
    ])

    const visits     = visitsRes.count ?? 0
    const revenue    = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const newClients = newClientsRes.count ?? 0
    const renewals   = renewalsRes.count ?? 0

    let msg  = `📊 *Отчёт за ${dateStr}*\n`
    msg     += `🏋️ ${club.name}\n\n`
    msg     += `💰 Выручка: *${revenue.toLocaleString("ru-RU")} сум*\n`
    msg     += `👟 Посещений: *${visits}*\n`
    msg     += `🆕 Новых клиентов: *${newClients}*\n`
    msg     += `🔄 Продлений: *${renewals}*\n`
    if (revenue === 0 && visits === 0) msg += `\n⚠️ Активности не было — проверьте систему.`

    const bot = new Bot(token)
    for (const chatId of targets) {
      await bot.api.sendMessage(chatId, msg, { parse_mode: "Markdown" }).catch(() => {})
      sent++
    }
  }

  return Response.json({ ok: true, sent })
}
