import { getBot } from "@/lib/telegram/bot"
import { createServiceClient } from "@/lib/supabase/service"

// Triggered by Vercel Cron at 04:00 UTC = 09:00 Tashkent (UTC+5)
// vercel.json: { "crons": [{ "path": "/api/telegram/daily-report", "schedule": "0 4 * * *" }] }
export async function GET(req: Request) {
  // Allow Vercel Cron (no auth header) OR manual call with secret
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ownerChatId = process.env.TELEGRAM_CHAT_ID
  if (!ownerChatId) {
    return Response.json({ error: "TELEGRAM_CHAT_ID not set" }, { status: 500 })
  }

  const supabase = createServiceClient()

  // Yesterday's date range (UTC)
  const now       = new Date()
  const todayUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterday = new Date(todayUTC.getTime() - 86_400_000)
  const from      = yesterday.toISOString()
  const to        = todayUTC.toISOString()

  // Get all clubs
  const { data: clubs } = await supabase.from("clubs").select("id, name")
  if (!clubs?.length) return Response.json({ ok: true, clubs: 0 })

  for (const club of clubs) {
    const [visitsRes, paymentsRes, newClientsRes, renewalsRes] = await Promise.all([
      // Visits yesterday
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .gte("checked_in_at", from)
        .lt("checked_in_at", to),

      // Revenue yesterday
      supabase
        .from("payments")
        .select("amount")
        .eq("club_id", club.id)
        .eq("status", "paid")
        .gte("paid_at", from)
        .lt("paid_at", to),

      // New clients yesterday
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .gte("created_at", from)
        .lt("created_at", to),

      // Renewals (subscriptions created yesterday)
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .gte("created_at", from)
        .lt("created_at", to),
    ])

    const visits     = visitsRes.count ?? 0
    const revenue    = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const newClients = newClientsRes.count ?? 0
    const renewals   = renewalsRes.count ?? 0

    const dateStr = yesterday.toLocaleDateString("ru-RU", {
      day: "numeric", month: "long", weekday: "long",
    })

    let msg = `📊 *Отчёт за ${dateStr}*\n`
    msg    += `🏋️ ${club.name}\n\n`
    msg    += `💰 Выручка: *${revenue.toLocaleString("ru-RU")} сум*\n`
    msg    += `👟 Посещений: *${visits}*\n`
    msg    += `🆕 Новых клиентов: *${newClients}*\n`
    msg    += `🔄 Продлений: *${renewals}*\n`

    if (revenue === 0 && visits === 0) {
      msg += `\n⚠️ Активности не было — проверьте систему.`
    }

    await getBot().api.sendMessage(ownerChatId, msg, { parse_mode: "Markdown" })
  }

  return Response.json({ ok: true })
}
