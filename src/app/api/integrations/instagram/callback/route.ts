import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { encryptIntegrationSecret } from "@/lib/crypto"
import { getInstagramConfig, instagramStateHash, syncInstagramConnection, type InstagramConnection } from "@/lib/instagram"

export const dynamic = "force-dynamic"

function back(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/integrations/instagram?oauth=${status}`, request.url))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")?.replace(/#_$/, "")
  const state = url.searchParams.get("state")
  if (!code || !state || url.searchParams.has("error")) return back(request, "cancelled")

  const service = createServiceClient()
  const now = new Date().toISOString()
  const { data: oauthState } = await service.from("integration_oauth_states")
    .update({ used_at: now })
    .eq("state_hash", instagramStateHash(state))
    .eq("provider", "instagram")
    .is("used_at", null)
    .gt("expires_at", now)
    .select("club_id, created_by")
    .maybeSingle()
  if (!oauthState) return back(request, "invalid_state")

  const config = getInstagramConfig()
  if (!config.configured) return back(request, "not_configured")

  try {
    const form = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    })
    const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    })
    const short = await shortResponse.json() as { access_token?: string; user_id?: string | number; permissions?: string[]; error_message?: string }
    if (!shortResponse.ok || !short.access_token) throw new Error(short.error_message || "OAuth exchange failed")

    const longUrl = new URL("https://graph.instagram.com/access_token")
    longUrl.searchParams.set("grant_type", "ig_exchange_token")
    longUrl.searchParams.set("client_secret", config.appSecret)
    longUrl.searchParams.set("access_token", short.access_token)
    const longResponse = await fetch(longUrl, { cache: "no-store" })
    const long = await longResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!longResponse.ok || !long.access_token) throw new Error(long.error?.message || "Long-lived token exchange failed")

    const profileUrl = new URL(`https://graph.instagram.com/${config.version}/me`)
    profileUrl.searchParams.set("fields", "id,user_id,username,name,account_type,profile_picture_url,followers_count,media_count")
    profileUrl.searchParams.set("access_token", long.access_token)
    const profileResponse = await fetch(profileUrl, { cache: "no-store" })
    const profile = await profileResponse.json() as Record<string, unknown> & { id?: string; error?: { message?: string } }
    if (!profileResponse.ok || !profile.id) throw new Error(profile.error?.message || "Instagram profile unavailable")

    const connection = {
      club_id: oauthState.club_id,
      provider: "instagram",
      external_account_id: profile.id,
      username: typeof profile.username === "string" ? profile.username : null,
      display_name: typeof profile.name === "string" ? profile.name : null,
      account_type: typeof profile.account_type === "string" ? profile.account_type : null,
      secret_enc: encryptIntegrationSecret(long.access_token),
      token_expires_at: new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000).toISOString(),
      scopes: short.permissions ?? [],
      status: "connected",
      metadata: {
        profile_picture_url: profile.profile_picture_url,
        followers_count: profile.followers_count,
        media_count: profile.media_count,
      },
      connected_by: oauthState.created_by,
      last_error: null,
      updated_at: now,
    }
    const { data, error } = await service.from("integration_connections").upsert(connection, {
      onConflict: "club_id,provider",
    }).select("*").single()
    if (error || !data) throw error ?? new Error("Connection save failed")

    const subscribeUrl = new URL(`https://graph.instagram.com/${config.version}/${profile.id}/subscribed_apps`)
    subscribeUrl.searchParams.set("subscribed_fields", "comments,messages,mentions,story_insights")
    subscribeUrl.searchParams.set("access_token", long.access_token)
    await fetch(subscribeUrl, { method: "POST", cache: "no-store" }).catch(() => null)
    await syncInstagramConnection(data as InstagramConnection).catch(() => null)
    return back(request, "connected")
  } catch {
    return back(request, "failed")
  }
}
