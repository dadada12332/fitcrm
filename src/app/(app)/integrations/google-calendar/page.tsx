import { redirect } from "next/navigation"

import {
  GoogleCalendarIntegration,
  type GoogleCalendarPageData,
} from "@/components/app/GoogleCalendarIntegration"
import { getCurrentClub } from "@/lib/club"
import { getGoogleCalendarConfig } from "@/lib/google-calendar"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const metadata = { title: "Google Calendar — Интеграции FitCRM" }

export default async function GoogleCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string }>
}) {
  const club = await getCurrentClub()
  if (!club) redirect("/login")
  if (!club.permissions.settings.integrations) redirect("/dashboard")

  const service = createServiceClient()
  const [{ data: connection }, { data: lastRun }] = await Promise.all([
    service.from("integration_connections")
      .select("username,display_name,status,metadata,last_synced_at,last_error")
      .eq("club_id", club.clubId)
      .eq("provider", "google_calendar")
      .maybeSingle(),
    service.from("integration_sync_runs")
      .select("items_synced,status,started_at")
      .eq("club_id", club.clubId)
      .eq("provider", "google_calendar")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const metadata = (connection?.metadata as Record<string, unknown> | null) ?? {}
  const data: GoogleCalendarPageData = {
    configured: getGoogleCalendarConfig().configured,
    connected: Boolean(connection),
    email: connection?.username ?? null,
    displayName: connection?.display_name ?? null,
    status: connection?.status ?? null,
    lastSyncedAt: connection?.last_synced_at ?? null,
    lastError: connection?.last_error ?? null,
    lastItems: Number(lastRun?.items_synced ?? 0),
    syncWindowDays: Number(metadata.sync_window_days ?? 180),
  }
  const { oauth } = await searchParams
  return <GoogleCalendarIntegration data={data} oauth={oauth} />
}

