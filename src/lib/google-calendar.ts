import crypto from "crypto"

import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/crypto"
import { createServiceClient } from "@/lib/supabase/service"

const PROVIDER = "google_calendar"
const CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SYNC_DAYS = 180
const DEFAULT_TIME_ZONE = "Asia/Tashkent"

type GoogleTokens = {
  accessToken: string
  refreshToken: string
}

export type GoogleCalendarConnection = {
  id: string
  club_id: string
  external_account_id: string
  username: string | null
  display_name: string | null
  secret_enc: string
  token_expires_at: string | null
  scopes: string[]
  status: "connected" | "error" | "expired" | "revoked"
  metadata: Record<string, unknown>
  last_synced_at: string | null
  last_error: string | null
}

type GoogleEvent = {
  id?: string
  summary?: string
  start?: { dateTime?: string }
  extendedProperties?: { private?: Record<string, string> }
}

type GoogleApiError = Error & { status?: number }

export function getGoogleCalendarConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? ""
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ""
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${appUrl}/api/integrations/google-calendar/callback`,
    configured: Boolean(clientId && clientSecret),
  }
}

export function googleCalendarStateHash(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex")
}

export function encodeGoogleCalendarTokens(tokens: GoogleTokens) {
  return encryptIntegrationSecret(JSON.stringify(tokens))
}

export function decodeGoogleCalendarTokens(secret: string): GoogleTokens {
  const parsed = JSON.parse(decryptIntegrationSecret(secret)) as Partial<GoogleTokens>
  if (!parsed.accessToken || !parsed.refreshToken) throw new Error("Токен Google Calendar повреждён")
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({})) as T & {
    error?: { message?: string }
    error_description?: string
  }
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || payload.error_description || `Google Calendar API ${response.status}`,
    ) as GoogleApiError
    error.status = response.status
    throw error
  }
  return payload
}

async function refreshAccessToken(connection: GoogleCalendarConnection, tokens: GoogleTokens) {
  const config = getGoogleCalendarConfig()
  if (!config.configured) throw new Error("Google Calendar OAuth не настроен")
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  })
  const result = await parseGoogleResponse<{ access_token: string; expires_in?: number }>(response)
  const next = { ...tokens, accessToken: result.access_token }
  const expiresAt = new Date(Date.now() + (result.expires_in ?? 3600) * 1000).toISOString()
  const service = createServiceClient()
  const { error } = await service.from("integration_connections").update({
    secret_enc: encodeGoogleCalendarTokens(next),
    token_expires_at: expiresAt,
    status: "connected",
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("club_id", connection.club_id).eq("provider", PROVIDER)
  if (error) throw new Error("Не удалось сохранить обновлённый токен Google")
  connection.secret_enc = encodeGoogleCalendarTokens(next)
  connection.token_expires_at = expiresAt
  return next.accessToken
}

async function accessToken(connection: GoogleCalendarConnection) {
  const tokens = decodeGoogleCalendarTokens(connection.secret_enc)
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  if (expiresAt > Date.now() + 60_000) return tokens.accessToken
  return refreshAccessToken(connection, tokens)
}

async function googleApi<T>(
  connection: GoogleCalendarConnection,
  path: string,
  init: RequestInit = {},
) {
  const token = await accessToken(connection)
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  })
  return parseGoogleResponse<T>(response)
}

function eventId(classId: string) {
  return `fitcrm${crypto.createHash("sha256").update(classId).digest("hex").slice(0, 40)}`
}

function dateTime(date: string, time: string) {
  const clean = time.slice(0, 8)
  return `${date}T${clean.length === 5 ? `${clean}:00` : clean}`
}

function addHour(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number)
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
}

async function listManagedEvents(connection: GoogleCalendarConnection) {
  const calendarId = String(connection.metadata.calendar_id || "primary")
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + SYNC_DAYS * 86_400_000).toISOString()
  const result: GoogleEvent[] = []
  let pageToken = ""
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      maxResults: "2500",
      privateExtendedProperty: `fitcrmClubId=${connection.club_id}`,
    })
    if (pageToken) params.set("pageToken", pageToken)
    const page = await googleApi<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      connection,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    )
    result.push(...(page.items ?? []))
    pageToken = page.nextPageToken ?? ""
  } while (pageToken)
  return result
}

export async function syncGoogleCalendarConnection(connection: GoogleCalendarConnection) {
  const service = createServiceClient()
  const { data: run, error: runError } = await service.from("integration_sync_runs").insert({
    club_id: connection.club_id,
    provider: PROVIDER,
    status: "running",
  }).select("id").single()
  if (runError || !run) throw runError ?? new Error("Не удалось начать синхронизацию")

  try {
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + SYNC_DAYS * 86_400_000).toISOString().slice(0, 10)
    const { data: classes, error: classesError } = await service
      .from("classes")
      .select("id,date,start_time,end_time,title,trainer_name,status,seats_total,room_id,rooms(name)")
      .eq("club_id", connection.club_id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
      .order("start_time")
    if (classesError) throw classesError

    const existing = await listManagedEvents(connection)
    const existingByClass = new Map(
      existing
        .map((event) => [event.extendedProperties?.private?.fitcrmClassId, event.id] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])),
    )
    const calendarId = String(connection.metadata.calendar_id || "primary")
    const timeZone = String(connection.metadata.time_zone || DEFAULT_TIME_ZONE)
    const keptEventIds = new Set<string>()
    let synced = 0

    for (const item of classes ?? []) {
      if (item.status === "cancelled") continue
      const room = item.rooms as unknown as { name?: string } | null
      const id = existingByClass.get(item.id) || eventId(item.id)
      const body = {
        id,
        summary: item.title || "Занятие FitCRM",
        description: [
          item.trainer_name ? `Тренер: ${item.trainer_name}` : null,
          Number(item.seats_total) > 0 ? `Мест: ${item.seats_total}` : null,
          "Синхронизировано из FitCRM",
        ].filter(Boolean).join("\n"),
        location: room?.name || undefined,
        start: { dateTime: dateTime(item.date, item.start_time), timeZone },
        end: { dateTime: dateTime(item.date, item.end_time || addHour(item.start_time)), timeZone },
        extendedProperties: {
          private: {
            fitcrmClubId: connection.club_id,
            fitcrmClassId: item.id,
          },
        },
      }
      const path = `/calendars/${encodeURIComponent(calendarId)}/events`
      if (existingByClass.has(item.id)) {
        await googleApi(connection, `${path}/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      } else {
        try {
          await googleApi(connection, path, { method: "POST", body: JSON.stringify(body) })
        } catch (cause) {
          const error = cause as GoogleApiError
          if (error.status !== 409) throw error
          await googleApi(connection, `${path}/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        }
      }
      keptEventIds.add(id)
      synced += 1
    }

    for (const event of existing) {
      if (event.id && !keptEventIds.has(event.id)) {
        await googleApi(connection, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`, {
          method: "DELETE",
        })
      }
    }

    const now = new Date().toISOString()
    await Promise.all([
      service.from("integration_connections").update({
        status: "connected",
        last_synced_at: now,
        last_error: null,
        updated_at: now,
      }).eq("id", connection.id).eq("club_id", connection.club_id).eq("provider", PROVIDER),
      service.from("integration_sync_runs").update({
        status: "completed",
        items_synced: synced,
        finished_at: now,
      }).eq("id", run.id).eq("club_id", connection.club_id),
    ])
    return { items: synced }
  } catch (cause) {
    const error = cause as GoogleApiError
    const message = error.message.slice(0, 500)
    const expired = error.status === 401
    const now = new Date().toISOString()
    await Promise.all([
      service.from("integration_connections").update({
        status: expired ? "expired" : "error",
        last_error: message,
        updated_at: now,
      }).eq("id", connection.id).eq("club_id", connection.club_id).eq("provider", PROVIDER),
      service.from("integration_sync_runs").update({
        status: "failed",
        error_message: message,
        finished_at: now,
      }).eq("id", run.id).eq("club_id", connection.club_id),
    ])
    throw error
  }
}

export async function removeManagedGoogleCalendarEvents(connection: GoogleCalendarConnection) {
  const calendarId = String(connection.metadata.calendar_id || "primary")
  const events = await listManagedEvents(connection)
  for (const event of events) {
    if (!event.id) continue
    await googleApi(connection, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`, {
      method: "DELETE",
    })
  }
}

