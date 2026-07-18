import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { getInstagramConfig, verifyMetaSignature } from "@/lib/instagram"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const config = getInstagramConfig()
  if (url.searchParams.get("hub.mode") !== "subscribe" ||
      url.searchParams.get("hub.verify_token") !== config.verifyToken || !config.verifyToken) {
    return new Response("Forbidden", { status: 403 })
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
}

export async function POST(request: Request) {
  const raw = await request.text()
  const config = getInstagramConfig()
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return new Response("Invalid signature", { status: 401 })
  }
  let payload: { entry?: Array<{ id?: string; changes?: Array<{ field?: string }> }> }
  try { payload = JSON.parse(raw) } catch { return new Response("Invalid payload", { status: 400 }) }

  const service = createServiceClient()
  for (const entry of payload.entry ?? []) {
    if (!entry.id) continue
    const { data: connection } = await service.from("integration_connections").select("club_id")
      .eq("provider", "instagram").eq("external_account_id", entry.id).maybeSingle()
    if (!connection) continue
    const eventId = crypto.createHash("sha256").update(`${entry.id}:${raw}`).digest("hex")
    await service.from("integration_events").upsert({
      club_id: connection.club_id,
      provider: "instagram",
      external_event_id: eventId,
      event_type: entry.changes?.map((item) => item.field).filter(Boolean).join(",") || "instagram_update",
      status: "received",
      payload: entry,
    }, { onConflict: "provider,external_event_id", ignoreDuplicates: true })
  }
  return Response.json({ received: true })
}
