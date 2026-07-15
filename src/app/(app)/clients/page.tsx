import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getClientsPage, CLIENTS_PAGE_SIZE } from "@/lib/clients"
import { getActiveMemberships } from "@/lib/memberships"
import { getTrainers } from "@/lib/staff"
import { ClientsStats } from "@/components/app/ClientsStats"
import { ClientsTable } from "@/components/app/ClientsTable"
import { AddClientButton } from "@/components/app/AddClientButton"
import { ImportClientsButton } from "@/components/app/ImportClientsButton"
import { ExportClientsButton } from "@/components/app/ExportClientsButton"
import { redirect } from "next/navigation"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.clients.view) redirect("/dashboard")

  const sp = await searchParams
  const arr = (v: string | string[] | undefined): string[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v]
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const query = {
    search: one(sp.q) ?? "",
    status: arr(sp.status),
    membership: arr(sp.membership),
    days: arr(sp.days),
    sort: one(sp.sort),
    page: Math.max(0, parseInt(one(sp.page) ?? "0", 10) || 0),
    pageSize: CLIENTS_PAGE_SIZE,
  }

  const [result, memberships, trainers] = await Promise.all([
    getClientsPage(supabase, club.clubId, query),
    getActiveMemberships(supabase, club.clubId),
    getTrainers(supabase, club.clubId),
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
          <ExportClientsButton />
          <ImportClientsButton />
          <AddClientButton memberships={memberships} trainers={trainers} />
        </div>
      </div>

      {/* Stat tiles */}
      <ClientsStats stats={result.stats} />

      {/* Clients table (серверная пагинация) */}
      <ClientsTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        membershipNames={result.membershipNames}
      />
    </div>
  )
}
