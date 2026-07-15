import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getMembershipsData } from "@/lib/memberships"
import { MembershipsStats } from "@/components/app/MembershipsStats"
import { MembershipsCards } from "@/components/app/MembershipsCards"
import { AddMembershipButton } from "@/components/app/AddMembershipButton"
import { redirect } from "next/navigation"

export default async function MembershipsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.memberships.view) redirect("/dashboard")
  const { rows, stats } = await getMembershipsData(supabase, club.clubId)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Абонементы</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
            Тарифные планы и абонементы, которые можно назначать клиентам
          </p>
        </div>
        <AddMembershipButton />
      </div>

      {/* Stat tiles */}
      <MembershipsStats stats={stats} />

      {/* Cards */}
      <MembershipsCards rows={rows} />
    </div>
  )
}
