import { createServiceClient } from "@/lib/supabase/service"
import { getRecipientsDataset, filterByAudience, sendBroadcast } from "@/lib/broadcast"

// Обработчик запланированных рассылок.
// Vercel Cron sends Authorization: Bearer CRON_SECRET.
// vercel.json: { "path": "/api/broadcasts/run", "schedule": "..." }
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("Authorization")

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
    const { data: claimed } = await supabase
      .from("broadcasts")
      .update({ status: "processing" })
      .eq("id", b.id)
      .eq("club_id", b.club_id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle()
    if (!claimed) continue

    const [{ data: club }, { data: integration }] = await Promise.all([
      supabase.from("clubs").select("name").eq("id", b.club_id).single(),
      supabase.from("telegram_integrations").select("bot_token").eq("club_id", b.club_id).maybeSingle(),
    ])
    const token = integration?.bot_token as string | null
    if (!token) {
      await supabase.from("broadcasts").update({ status: "failed" }).eq("id", b.id).eq("club_id", b.club_id)
      continue
    }

    const dataset = await getRecipientsDataset(supabase, b.club_id)
    const recipients = filterByAudience(dataset, b.audience, (b.recipient_ids as number[] | null) ?? undefined)

    const { delivered, failed } = await sendBroadcast(token, recipients, b.message ?? "", b.image_url, club?.name ?? "Клуб")

    await supabase.from("broadcasts").update({
      status: "sent", sent_at: new Date().toISOString(),
      total: recipients.length, delivered, failed,
    }).eq("id", b.id).eq("club_id", b.club_id)
    processed++
  }

  return Response.json({ ok: true, processed })
}
