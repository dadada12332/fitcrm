import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { getInstagramConfig, parseSignedRequest } from "@/lib/instagram"

export async function POST(request: Request) {
  let signedRequest: FormDataEntryValue | null = null
  try {
    signedRequest = (await request.formData()).get("signed_request")
  } catch {
    return Response.json({ error: "Invalid signed request" }, { status: 401 })
  }
  const config = getInstagramConfig()
  const payload = typeof signedRequest === "string" ? parseSignedRequest(signedRequest, config.appSecret) : null
  const accountId = payload && (payload.user_id ?? payload.profile_id)
  if (typeof accountId !== "string" && typeof accountId !== "number") {
    return Response.json({ error: "Invalid signed request" }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: connection } = await service.from("integration_connections").select("club_id")
    .eq("provider", "instagram").eq("external_account_id", String(accountId)).maybeSingle()
  if (connection) {
    await Promise.all([
      service.from("integration_connections").delete().eq("club_id", connection.club_id).eq("provider", "instagram"),
      service.from("instagram_media").delete().eq("club_id", connection.club_id),
      service.from("instagram_daily_insights").delete().eq("club_id", connection.club_id),
      service.from("integration_sync_runs").delete().eq("club_id", connection.club_id).eq("provider", "instagram"),
      service.from("integration_events").delete().eq("club_id", connection.club_id).eq("provider", "instagram"),
    ])
  }
  const confirmationCode = crypto.randomBytes(16).toString("hex")
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
  return Response.json({
    url: `${appUrl}/api/integrations/instagram/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
