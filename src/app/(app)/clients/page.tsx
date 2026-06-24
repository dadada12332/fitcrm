import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getClientsData } from "@/lib/clients"
import { getActiveMemberships } from "@/lib/memberships"
import { ClientsStats } from "@/components/app/ClientsStats"
import { ClientsTable } from "@/components/app/ClientsTable"
import { AddClientButton } from "@/components/app/AddClientButton"

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
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "#020617" }}>Клиенты</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            База клиентов, абонементы, посещения и баланс
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium"
            style={{ background: "white", color: "#020617", border: "1px solid #e2e8f0" }}
          >
            <Download className="w-4 h-4" />
            Экспорт в excel
          </button>
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
