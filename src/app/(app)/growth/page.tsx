import { redirect } from "next/navigation"
import { GrowthCenter } from "@/components/app/GrowthCenter"
import { getCurrentClub } from "@/lib/club"
import { getClientsForExport } from "@/lib/clients"
import { getDashboardData } from "@/lib/dashboard"
import { buildGrowthData, mapGrowthExperimentRun, type GrowthExperimentRunRow } from "@/lib/growth"
import { buildRetentionData } from "@/lib/retention"
import { createClient } from "@/lib/supabase/server"
import { planFeatureEnabled, planSectionEnabled } from "@/lib/plan-access"

export default async function GrowthPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.reports.view || !club.permissions.clients.view) redirect("/dashboard")
  if (!planSectionEnabled(club.planAccess, "growth") || !planFeatureEnabled(club.planAccess, "growth")) redirect("/dashboard")

  const supabase = await createClient()
  const [clients, membershipsResult, dashboard, experimentRunsResult] = await Promise.all([
    getClientsForExport(supabase, club.clubId, {}),
    supabase.from("memberships").select("name, price").eq("club_id", club.clubId),
    getDashboardData(supabase, club.clubId, club.permissions.reports.finance || club.permissions.dashboard.view_finance),
    supabase.from("growth_experiment_runs").select("*").eq("club_id", club.clubId).order("started_at", { ascending: false }).limit(30),
  ])
  const membershipPrices = Object.fromEntries((membershipsResult.data ?? []).map((membership) => [membership.name, Number(membership.price ?? 0)]))
  const retention = buildRetentionData(clients, membershipPrices)

  const runs = ((experimentRunsResult.data ?? []) as GrowthExperimentRunRow[]).map(mapGrowthExperimentRun)

  return <GrowthCenter data={buildGrowthData(dashboard, retention)} initialRuns={runs} />
}
