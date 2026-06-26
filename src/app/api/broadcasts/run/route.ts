import { createServiceClient } from "@/lib/supabase/service"
import { getRecipientsDataset, filterByAudience, sendBroadcast } from "@/lib/broadcast"

// Обработчик запланированных рассылок.
// Vercel Cron (без заголовка) ИЛИ ручной вызов с ?secret=... / Bearer CRON_SECRET.
// vercel.json: { "path": "/api/broadcasts/run", "schedule": "..." }
export async function GET(req: Request) {
  const url = new URL(req.url)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("Authorization")
  const querySecret = url.searchParams.get("secret")

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: due } = await supabase
    .from("broadcasts")
    .select("id, club_id, message, image_url, audience, recipient_ids")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(50)

  if (!due?.length) return Response.json({ ok: true, processed: 0 })

  let processed = 0
  for (const b of due) {
    const { data: club } = await supabase.from("clubs").select("name, tg_token").eq("id", b.club_id).single()
    const token = club?.tg_token as string | null
    if (!token) {
      await supabase.from("broadcasts").update({ status: "failed" }).eq("id", b.id)
      continue
    }

    const dataset = await getRecipientsDataset(supabase, b.club_id)
    const recipients = filterByAudience(dataset, b.audience, (b.recipient_ids as number[] | null) ?? undefined)

    const { delivered, failed } = await sendBroadcast(token, recipients, b.message ?? "", b.image_url, club?.name ?? "Клуб")

    await supabase.from("broadcasts").update({
      status: "sent", sent_at: new Date().toISOString(),
      total: recipients.length, delivered, failed,
    }).eq("id", b.id)
    processed++
  }

  return Response.json({ ok: true, processed })
}
