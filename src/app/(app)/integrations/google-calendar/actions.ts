"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"

import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import {
  decodeGoogleCalendarTokens,
  getGoogleCalendarConfig,
  googleCalendarStateHash,
  removeManagedGoogleCalendarEvents,
  syncGoogleCalendarConnection,
  type GoogleCalendarConnection,
} from "@/lib/google-calendar"
import { can } from "@/lib/permissions"
import { requireIntegrationSlot } from "@/lib/plan-enforcement"
import { createServiceClient } from "@/lib/supabase/service"

const PROVIDER = "google_calendar"

async function context() {
  const [user, club] = await Promise.all([getAuthUser(), getCurrentClub()])
  if (!user) return { ok: false as const, error: "Не авторизован" }
  if (!club) return { ok: false as const, error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "integrations")) {
    return { ok: false as const, error: "Недостаточно прав" }
  }
  return { ok: true as const, user, club }
}

export async function startGoogleCalendarOAuthAction(): Promise<{ url?: string; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const config = getGoogleCalendarConfig()
  if (!config.configured) {
    return { error: "Сначала добавьте Google Calendar Client ID и Client Secret в Vercel" }
  }

  const service = createServiceClient()
  const { data: existing } = await service.from("integration_connections").select("id")
    .eq("club_id", ctx.club.clubId).eq("provider", PROVIDER).maybeSingle()
  if (!existing) {
    const limitError = await requireIntegrationSlot(ctx.club)
    if (limitError) return { error: limitError }
  }

  const state = crypto.randomBytes(32).toString("base64url")
  const { error } = await service.from("integration_oauth_states").insert({
    state_hash: googleCalendarStateHash(state),
    club_id: ctx.club.clubId,
    provider: PROVIDER,
    created_by: ctx.user.id,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  })
  if (error) return { error: "Не удалось начать подключение Google Calendar" }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" "))
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent select_account")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", state)
  return { url: url.toString() }
}

export async function syncGoogleCalendarAction(): Promise<{ ok?: boolean; items?: number; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const service = createServiceClient()
  const { data } = await service.from("integration_connections").select("*")
    .eq("club_id", ctx.club.clubId).eq("provider", PROVIDER).maybeSingle()
  if (!data) return { error: "Google Calendar ещё не подключён" }

  try {
    const result = await syncGoogleCalendarConnection(data as GoogleCalendarConnection)
    revalidatePath("/integrations")
    revalidatePath("/integrations/google-calendar")
    return { ok: true, items: result.items }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось синхронизировать Google Calendar",
    }
  }
}

export async function disconnectGoogleCalendarAction(): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const service = createServiceClient()
  const { data } = await service.from("integration_connections").select("*")
    .eq("club_id", ctx.club.clubId).eq("provider", PROVIDER).maybeSingle()
  if (!data) return { ok: true }

  const connection = data as GoogleCalendarConnection
  try {
    await removeManagedGoogleCalendarEvents(connection)
  } catch {
    // Local disconnect must remain possible if Google is temporarily unavailable.
  }
  try {
    const tokens = decodeGoogleCalendarTokens(connection.secret_enc)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    })
  } catch {
    // The encrypted credential is still removed locally below.
  }

  await Promise.all([
    service.from("integration_connections").delete()
      .eq("id", connection.id).eq("club_id", ctx.club.clubId).eq("provider", PROVIDER),
    service.from("integration_sync_runs").delete()
      .eq("club_id", ctx.club.clubId).eq("provider", PROVIDER),
  ])
  revalidatePath("/integrations")
  revalidatePath("/integrations/google-calendar")
  return { ok: true }
}

