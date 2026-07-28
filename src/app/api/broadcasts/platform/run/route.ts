import { createServiceClient } from "@/lib/supabase/service"
import { withPlatformCronRun } from "@/lib/platform-cron"

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

async function sendTelegram(token: string, telegramId: number, title: string, body: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { description?: string } | null
    throw new Error(payload?.description ?? `Telegram HTTP ${response.status}`)
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  return withPlatformCronRun("platform_broadcasts", async () => {
  const db = createServiceClient()
  const { data: due, error } = await db.from("platform_broadcasts")
    .select("id, title, body")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10)
  if (error) return Response.json({ error: "Queue unavailable" }, { status: 500 })
  if (!due?.length) return Response.json({ ok: true, processed: 0 })

  let processed = 0
  for (const campaign of due) {
    const { data: claimed } = await db.from("platform_broadcasts")
      .update({ status: "processing", last_error: null })
      .eq("id", campaign.id).eq("status", "scheduled")
      .select("id").maybeSingle()
    if (!claimed) continue

    const { data: deliveries } = await db.from("platform_broadcast_deliveries")
      .select("id, club_id, telegram_id, attempts")
      .eq("broadcast_id", campaign.id)
      .eq("status", "queued")

    const clubIds = Array.from(new Set((deliveries ?? []).map((delivery) => delivery.club_id)))
    const { data: integrations } = clubIds.length
      ? await db.from("telegram_integrations").select("club_id, bot_token").in("club_id", clubIds)
      : { data: [] }
    const tokenByClub = new Map((integrations ?? []).map((integration) => [integration.club_id, integration.bot_token]))

    for (const delivery of deliveries ?? []) {
      const { data: deliveryClaim } = await db.from("platform_broadcast_deliveries")
        .update({ status: "processing", attempts: delivery.attempts + 1 })
        .eq("id", delivery.id).eq("status", "queued")
        .select("id").maybeSingle()
      if (!deliveryClaim) continue
      const token = tokenByClub.get(delivery.club_id)
      if (!token) {
        await db.from("platform_broadcast_deliveries")
          .update({ status: "failed", last_error: "У клуба не подключён Telegram-бот" })
          .eq("id", delivery.id)
        continue
      }
      try {
        await sendTelegram(token, Number(delivery.telegram_id), campaign.title, campaign.body)
        await db.from("platform_broadcast_deliveries")
          .update({ status: "delivered", delivered_at: new Date().toISOString(), last_error: null })
          .eq("id", delivery.id)
      } catch (sendError) {
        await db.from("platform_broadcast_deliveries")
          .update({ status: "failed", last_error: sendError instanceof Error ? sendError.message.slice(0, 500) : "Telegram error" })
          .eq("id", delivery.id)
      }
    }

    const { data: finalRows } = await db.from("platform_broadcast_deliveries")
      .select("status").eq("broadcast_id", campaign.id)
    const delivered = (finalRows ?? []).filter((row) => row.status === "delivered").length
    const failed = (finalRows ?? []).filter((row) => row.status === "failed").length
    const status = delivered === 0 ? "failed" : failed > 0 ? "partial" : "sent"
    await db.from("platform_broadcasts").update({
      status,
      delivered_count: delivered,
      failed_count: failed,
      sent_at: new Date().toISOString(),
      last_error: delivered === 0 && failed > 0 ? "Не удалось доставить ни одного сообщения" : null,
    }).eq("id", campaign.id).eq("status", "processing")
    processed += 1
  }

  return Response.json({ ok: true, processed })
  })
}
