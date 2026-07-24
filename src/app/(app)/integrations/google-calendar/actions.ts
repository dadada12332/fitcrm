"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"

import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import {
  createGoogleCalendarEvent,
  decodeGoogleCalendarTokens,
  getGoogleCalendarConfig,
  googleCalendarStateHash,
  transferVisitToGoogleCalendar,
  type GoogleCalendarConnection,
} from "@/lib/google-calendar"
import { can } from "@/lib/permissions"
import { requireIntegrationSlot } from "@/lib/plan-enforcement"
import { createClient } from "@/lib/supabase/server"
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
    return { error: "Подключение Google Calendar временно недоступно" }
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

async function getConnection(clubId: string) {
  const service = createServiceClient()
  const { data } = await service.from("integration_connections").select("*")
    .eq("club_id", clubId).eq("provider", PROVIDER).maybeSingle()
  return data as GoogleCalendarConnection | null
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export async function createGoogleCalendarEventAction(input: {
  title: string
  description?: string
  date: string
  startTime: string
  endTime: string
}): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const title = input.title?.trim()
  const description = input.description?.trim().slice(0, 2000)
  if (!title || title.length > 120) return { error: "Введите название до 120 символов" }
  if (!validDate(input.date) || !validTime(input.startTime) || !validTime(input.endTime)) {
    return { error: "Проверьте дату и время события" }
  }
  if (input.endTime <= input.startTime) return { error: "Время окончания должно быть позже начала" }
  const connection = await getConnection(ctx.club.clubId)
  if (!connection) return { error: "Google Calendar ещё не подключён" }

  try {
    await createGoogleCalendarEvent(connection, {
      title,
      description,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
    })
    await createServiceClient().from("integration_connections").update({
      last_synced_at: new Date().toISOString(),
      last_error: null,
      status: "connected",
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("club_id", ctx.club.clubId).eq("provider", PROVIDER)
    revalidatePath("/integrations/google-calendar")
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось создать событие",
    }
  }
}

export async function transferVisitsToGoogleCalendarAction(
  visitIds: string[],
): Promise<{ ok?: boolean; items?: number; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  if (!can(ctx.club.permissions, "visits", "view")) return { error: "Нет доступа к посещениям" }
  const ids = [...new Set(visitIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20)
  if (!ids.length) return { error: "Выберите хотя бы одно посещение" }
  const connection = await getConnection(ctx.club.clubId)
  if (!connection) return { error: "Google Calendar ещё не подключён" }

  const supabase = await createClient()
  const { data, error } = await supabase.from("visits")
    .select("id,checked_in_at,comment,clients(full_name)")
    .eq("club_id", ctx.club.clubId)
    .in("id", ids)
  if (error) return { error: "Не удалось загрузить выбранные посещения" }
  if ((data ?? []).length !== ids.length) return { error: "Часть посещений не найдена в текущем клубе" }

  try {
    for (const visit of data ?? []) {
      const client = visit.clients as unknown as { full_name?: string } | null
      await transferVisitToGoogleCalendar(connection, {
        id: visit.id,
        clientName: client?.full_name || "Клиент",
        checkedInAt: visit.checked_in_at,
        comment: visit.comment,
      })
    }
    const now = new Date().toISOString()
    await createServiceClient().from("integration_connections").update({
      last_synced_at: now,
      last_error: null,
      status: "connected",
      updated_at: now,
    }).eq("id", connection.id).eq("club_id", ctx.club.clubId).eq("provider", PROVIDER)
    revalidatePath("/integrations/google-calendar")
    return { ok: true, items: data?.length ?? 0 }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось перенести посещения",
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
