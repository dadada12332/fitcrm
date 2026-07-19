import { redirect } from "next/navigation"
import { GrowthCenter } from "@/components/app/GrowthCenter"
import { getCurrentClub } from "@/lib/club"
import { getClientsForExport } from "@/lib/clients"
import { getDashboardData } from "@/lib/dashboard"
import { buildGrowthData } from "@/lib/growth"
import { buildRetentionData } from "@/lib/retention"
import { createClient } from "@/lib/supabase/server"

export default async function GrowthPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.reports.view || !club.permissions.clients.view) redirect("/dashboard")

  const supabase = await createClient()
  const [clients, membershipsResult, dashboard] = await Promise.all([
    getClientsForExport(supabase, club.clubId, {}),
    supabase.from("memberships").select("name, price").eq("club_id", club.clubId),
    getDashboardData(supabase, club.clubId),
  ])
  const membershipPrices = Object.fromEntries((membershipsResult.data ?? []).map((membership) => [membership.name, Number(membership.price ?? 0)]))
  const retention = buildRetentionData(clients, membershipPrices)

  return <GrowthCenter data={buildGrowthData(dashboard, retention)} />
}
