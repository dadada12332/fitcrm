import { redirect } from "next/navigation"

import {
  GoogleCalendarIntegration,
  type GoogleCalendarPageData,
} from "@/components/app/GoogleCalendarIntegration"
import { getCurrentClub } from "@/lib/club"
import {
  getGoogleCalendarConfig,
  listGoogleCalendarEvents,
  type GoogleCalendarConnection,
} from "@/lib/google-calendar"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const metadata = { title: "Google Calendar — Интеграции FitCRM" }

export default async function GoogleCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; month?: string }>
}) {
  const club = await getCurrentClub()
  if (!club) redirect("/login")
  if (!club.permissions.settings.integrations) redirect("/dashboard")

  const { oauth, month: requestedMonth } = await searchParams
  const currentMonth = tashkentMonth()
  const month = /^\d{4}-\d{2}$/.test(requestedMonth ?? "") ? requestedMonth! : currentMonth
  const { start, end } = monthRange(month)
  const service = createServiceClient()
  const { data: connection } = await service.from("integration_connections")
    .select("*")
    .eq("club_id", club.clubId)
    .eq("provider", "google_calendar")
    .maybeSingle()

  let events: GoogleCalendarPageData["events"] = []
  let eventsError: string | null = null
  if (connection) {
    try {
      events = await listGoogleCalendarEvents(
        connection as GoogleCalendarConnection,
        start.toISOString(),
        end.toISOString(),
      )
    } catch {
      eventsError = "Не удалось обновить события Google. Повторите позже."
    }
  }

  let visits: GoogleCalendarPageData["visits"] = []
  if (connection && club.permissions.visits.view) {
    const supabase = await createClient()
    const since = recentVisitStart()
    const { data: visitRows } = await supabase.from("visits")
      .select("id,checked_in_at,comment,method,clients(full_name)")
      .eq("club_id", club.clubId)
      .gte("checked_in_at", since)
      .order("checked_in_at", { ascending: false })
      .limit(30)
    visits = (visitRows ?? []).map((visit) => {
      const client = visit.clients as unknown as { full_name?: string } | null
      return {
        id: visit.id,
        clientName: client?.full_name || "Клиент",
        checkedInAt: visit.checked_in_at,
        comment: visit.comment,
        method: visit.method,
      }
    })
  }

  const data: GoogleCalendarPageData = {
    configured: getGoogleCalendarConfig().configured,
    connected: Boolean(connection),
    email: connection?.username ?? null,
    displayName: connection?.display_name ?? null,
    status: connection?.status ?? null,
    lastSyncedAt: connection?.last_synced_at ?? null,
    lastError: connection?.last_error ?? null,
    month,
    events,
    eventsError,
    visits,
  }
  return <GoogleCalendarIntegration data={data} oauth={oauth} />
}

function tashkentMonth() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  return `${year}-${month}`
}

function recentVisitStart() {
  return new Date(Date.now() - 30 * 86_400_000).toISOString()
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return {
    start: new Date(`${month}-01T00:00:00+05:00`),
    end: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:00`),
  }
}
