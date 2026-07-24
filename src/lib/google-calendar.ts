import crypto from "crypto"

import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/crypto"
import { createServiceClient } from "@/lib/supabase/service"

const PROVIDER = "google_calendar"
const CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
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
  description?: string
  location?: string
  htmlLink?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}

export type GoogleCalendarEventItem = {
  id: string
  title: string
  description: string | null
  location: string | null
  start: string
  end: string
  allDay: boolean
  htmlLink: string | null
  source: "google" | "fitcrm_visit" | "fitcrm_manual"
}

export type CreateGoogleCalendarEventInput = {
  title: string
  description?: string
  date: string
  startTime: string
  endTime: string
}

export type GoogleCalendarVisitInput = {
  id: string
  clientName: string
  checkedInAt: string
  comment?: string | null
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

function eventId(source: string, sourceId: string) {
  return `fitcrm${crypto.createHash("sha256").update(`${source}:${sourceId}`).digest("hex").slice(0, 40)}`
}

function dateTime(date: string, time: string) {
  const clean = time.slice(0, 8)
  return `${date}T${clean.length === 5 ? `${clean}:00` : clean}`
}

function calendarPath(connection: GoogleCalendarConnection) {
  const calendarId = String(connection.metadata.calendar_id || "primary")
  return `/calendars/${encodeURIComponent(calendarId)}/events`
}

async function listEvents(
  connection: GoogleCalendarConnection,
  timeMin: string,
  timeMax: string,
  privateExtendedProperty?: string,
) {
  const result: GoogleEvent[] = []
  let pageToken = ""
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      maxResults: "2500",
      orderBy: "startTime",
    })
    if (privateExtendedProperty) params.set("privateExtendedProperty", privateExtendedProperty)
    if (pageToken) params.set("pageToken", pageToken)
    const page = await googleApi<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      connection,
      `${calendarPath(connection)}?${params}`,
    )
    result.push(...(page.items ?? []))
    pageToken = page.nextPageToken ?? ""
  } while (pageToken)
  return result
}

export async function listGoogleCalendarEvents(
  connection: GoogleCalendarConnection,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEventItem[]> {
  const events = await listEvents(connection, timeMin, timeMax)
  return events
    .filter((event): event is GoogleEvent & { id: string } => Boolean(event.id && event.status !== "cancelled"))
    .map((event) => {
      const privateData = event.extendedProperties?.private ?? {}
      return {
        id: event.id,
        title: event.summary || "Без названия",
        description: event.description || null,
        location: event.location || null,
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        allDay: Boolean(event.start?.date && !event.start?.dateTime),
        htmlLink: event.htmlLink || null,
        source: privateData.fitcrmVisitId
          ? "fitcrm_visit"
          : privateData.fitcrmManual === "true"
            ? "fitcrm_manual"
            : "google",
      }
    })
}

export async function createGoogleCalendarEvent(
  connection: GoogleCalendarConnection,
  input: CreateGoogleCalendarEventInput,
) {
  const timeZone = String(connection.metadata.time_zone || DEFAULT_TIME_ZONE)
  return googleApi<GoogleEvent>(connection, calendarPath(connection), {
    method: "POST",
    body: JSON.stringify({
      summary: input.title,
      description: input.description || undefined,
      start: { dateTime: dateTime(input.date, input.startTime), timeZone },
      end: { dateTime: dateTime(input.date, input.endTime), timeZone },
      extendedProperties: {
        private: {
          fitcrmClubId: connection.club_id,
          fitcrmManual: "true",
        },
      },
    }),
  })
}

export async function transferVisitToGoogleCalendar(
  connection: GoogleCalendarConnection,
  visit: GoogleCalendarVisitInput,
) {
  const id = eventId("visit", visit.id)
  const start = new Date(visit.checkedInAt)
  const end = new Date(start.getTime() + 60 * 60_000)
  const body = {
    id,
    summary: `Посещение · ${visit.clientName}`,
    description: [
      visit.comment || null,
      "Перенесено вручную из журнала посещений FitCRM",
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        fitcrmClubId: connection.club_id,
        fitcrmVisitId: visit.id,
      },
    },
  }
  try {
    return await googleApi<GoogleEvent>(connection, calendarPath(connection), {
      method: "POST",
      body: JSON.stringify(body),
    })
  } catch (cause) {
    const error = cause as GoogleApiError
    if (error.status !== 409) throw error
    return googleApi<GoogleEvent>(connection, `${calendarPath(connection)}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }
}

export async function removeManagedGoogleCalendarEvents(connection: GoogleCalendarConnection) {
  const timeMin = new Date(Date.now() - 365 * 86_400_000).toISOString()
  const timeMax = new Date(Date.now() + 365 * 86_400_000).toISOString()
  const events = await listEvents(
    connection,
    timeMin,
    timeMax,
    `fitcrmClubId=${connection.club_id}`,
  )
  for (const event of events) {
    if (!event.id) continue
    await googleApi(connection, `${calendarPath(connection)}/${encodeURIComponent(event.id)}`, {
      method: "DELETE",
    })
  }
}
