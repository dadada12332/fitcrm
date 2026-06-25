import { createClient } from "@/lib/supabase/server"
import { getMembershipsData } from "@/lib/memberships"
import { MembershipsStats } from "@/components/app/MembershipsStats"
import { MembershipsCards } from "@/components/app/MembershipsCards"
import { AddMembershipButton } from "@/components/app/AddMembershipButton"

export default async function MembershipsPage() {
  const supabase = await createClient()
  const { rows, stats } = await getMembershipsData(supabase)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
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
