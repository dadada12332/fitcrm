import { redirect } from "next/navigation"
import { RetentionCenter } from "@/components/app/RetentionCenter"
import { getCurrentClubForPage } from "@/lib/club"
import { getClientsForExport } from "@/lib/clients"
import { buildRetentionData } from "@/lib/retention"
import { createClient } from "@/lib/supabase/server"
import { planFeatureEnabled, planSectionEnabled } from "@/lib/plan-access"

export default async function RetentionPage() {
  const club = await getCurrentClubForPage()
  if (!club) redirect("/onboarding")
  if (!club.permissions.reports.view || !club.permissions.clients.view) redirect("/dashboard")
  if (!planSectionEnabled(club.planAccess, "retention") || !planFeatureEnabled(club.planAccess, "retention")) redirect("/dashboard")

  const supabase = await createClient()
  const [clients, membershipsResult] = await Promise.all([
    getClientsForExport(supabase, club.clubId, {}),
    supabase
      .from("memberships")
      .select("id, name, price, duration_days, visits_limit")
      .eq("club_id", club.clubId)
      .eq("is_active", true)
      .order("price", { ascending: true }),
  ])

  const membershipPrices = Object.fromEntries(
    (membershipsResult.data ?? []).map((membership) => [membership.name, Number(membership.price ?? 0)]),
  )

  const memberships = (membershipsResult.data ?? []).map((membership) => ({
    id: membership.id,
    name: membership.name,
    price: Number(membership.price ?? 0),
    durationDays: Number(membership.duration_days ?? 30),
    visitsLimit: membership.visits_limit == null ? null : Number(membership.visits_limit),
  }))

  return (
    <RetentionCenter
      data={buildRetentionData(clients, membershipPrices)}
      memberships={memberships}
      canExtend={club.permissions.clients.extend}
    />
  )
}
