import { createClient } from "@/lib/supabase/server"
import { getClientsData } from "@/lib/clients"
import { getActiveMemberships } from "@/lib/memberships"
import { ClientsStats } from "@/components/app/ClientsStats"
import { ClientsTable } from "@/components/app/ClientsTable"
import { AddClientButton } from "@/components/app/AddClientButton"
import { ImportClientsButton } from "@/components/app/ImportClientsButton"

export default async function ClientsPage() {
  const supabase = await createClient()
  const [{ rows, stats }, memberships] = await Promise.all([
    getClientsData(supabase),
    getActiveMemberships(supabase),
  ])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Клиенты</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
            База клиентов, абонементы, посещения и баланс
          </p>
        </div>
        <div className="flex items-center gap-3">
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
