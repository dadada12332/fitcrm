import { NextResponse } from "next/server"

import {
  decodeGoogleCalendarTokens,
  encodeGoogleCalendarTokens,
  getGoogleCalendarConfig,
  googleCalendarStateHash,
} from "@/lib/google-calendar"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const PROVIDER = "google_calendar"

function back(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/integrations/google-calendar?oauth=${status}`, request.url))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state || url.searchParams.has("error")) return back(request, "cancelled")

  const service = createServiceClient()
  const now = new Date().toISOString()
  const { data: oauthState } = await service.from("integration_oauth_states")
    .update({ used_at: now })
    .eq("state_hash", googleCalendarStateHash(state))
    .eq("provider", PROVIDER)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("club_id,created_by")
    .maybeSingle()
  if (!oauthState) return back(request, "invalid_state")

  const config = getGoogleCalendarConfig()
  if (!config.configured) return back(request, "not_configured")

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    })
    const token = await tokenResponse.json() as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
      error_description?: string
    }
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token.error_description || "OAuth exchange failed")
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    })
    const profile = await profileResponse.json() as {
      sub?: string
      email?: string
      name?: string
      picture?: string
      error_description?: string
    }
    if (!profileResponse.ok || !profile.sub) {
      throw new Error(profile.error_description || "Google profile unavailable")
    }

    const { data: previous } = await service.from("integration_connections")
      .select("secret_enc")
      .eq("club_id", oauthState.club_id)
      .eq("provider", PROVIDER)
      .maybeSingle()
    let refreshToken = token.refresh_token
    if (!refreshToken && previous?.secret_enc) {
      refreshToken = decodeGoogleCalendarTokens(previous.secret_enc).refreshToken
    }
    if (!refreshToken) throw new Error("Google не вернул refresh token")

    const connection = {
      club_id: oauthState.club_id,
      provider: PROVIDER,
      external_account_id: profile.sub,
      username: profile.email ?? null,
      display_name: profile.name ?? profile.email ?? "Google Calendar",
      account_type: "google",
      secret_enc: encodeGoogleCalendarTokens({
        accessToken: token.access_token,
        refreshToken,
      }),
      token_expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      scopes: token.scope?.split(" ").filter(Boolean) ?? [],
      status: "connected",
      metadata: {
        calendar_id: "primary",
        time_zone: "Asia/Tashkent",
        picture: profile.picture,
      },
      connected_by: oauthState.created_by,
      last_error: null,
      updated_at: now,
    }
    const { error } = await service.from("integration_connections").upsert(connection, {
      onConflict: "club_id,provider",
    })
    if (error) throw error

    return back(request, "connected")
  } catch {
    return back(request, "failed")
  }
}
