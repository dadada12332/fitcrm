import { redirect } from "next/navigation"
import { RetentionCenter } from "@/components/app/RetentionCenter"
import { getCurrentClub } from "@/lib/club"
import { getClientsForExport } from "@/lib/clients"
import { buildRetentionData } from "@/lib/retention"
import { createClient } from "@/lib/supabase/server"
import { planFeatureEnabled, planSectionEnabled } from "@/lib/plan-access"

export default async function RetentionPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.reports.view || !club.permissions.clients.view) redirect("/dashboard")
  if (!planSectionEnabled(club.planAccess, "retention") || !planFeatureEnabled(club.planAccess, "retention")) redirect("/dashboard")

  const supabase = await createClient()
  const [clients, membershipsResult] = await Promise.all([
    getClientsForExport(supabase, club.clubId, {}),
    supabase.from("memberships").select("name, price").eq("club_id", club.clubId),
  ])

  const membershipPrices = Object.fromEntries(
    (membershipsResult.data ?? []).map((membership) => [membership.name, Number(membership.price ?? 0)]),
  )

  return <RetentionCenter data={buildRetentionData(clients, membershipPrices)} />
}
