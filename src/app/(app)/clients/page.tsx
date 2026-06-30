import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getClientsData } from "@/lib/clients"
import { getActiveMemberships } from "@/lib/memberships"
import { ClientsStats } from "@/components/app/ClientsStats"
import { ClientsTable } from "@/components/app/ClientsTable"
import { AddClientButton } from "@/components/app/AddClientButton"
import { ImportClientsButton } from "@/components/app/ImportClientsButton"
import { ExportClientsButton } from "@/components/app/ExportClientsButton"
import { redirect } from "next/navigation"

export default async function ClientsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  const [{ rows, stats }, memberships] = await Promise.all([
    getClientsData(supabase, club.clubId),
    getActiveMemberships(supabase, club.clubId),
  ])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Клиенты</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
            База клиентов, абонементы, посещения и баланс
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportClientsButton rows={rows} />
          <ImportClientsButton />
          <AddClientButton memberships={memberships} />
        </div>
      </div>

      {/* Stat tiles */}
      <ClientsStats stats={stats} />

      {/* Clients table */}
      <ClientsTable rows={rows} />
    </div>
  )
}
