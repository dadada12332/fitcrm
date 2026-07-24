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
import { sanitizeSearchTerm } from "@/lib/search"

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
    search: sanitizeSearchTerm(one(sp.q) ?? ""),
    status: arr(sp.status),
    membership: arr(sp.membership),
    days: arr(sp.days),
    sort: one(sp.sort),
    page: Math.max(0, parseInt(one(sp.page) ?? "0", 10) || 0),
    pageSize: CLIENTS_PAGE_SIZE,
  }

  const [result, memberships, trainers] = await Promise.all([
    getClientsPage(supabase, club.clubId, query),
    club.permissions.memberships.view ? getActiveMemberships(supabase, club.clubId) : Promise.resolve([]),
    club.permissions.staff.view ? getTrainers(supabase, club.clubId) : Promise.resolve([]),
  ])
  const showFinancials = club.permissions.payments.view || club.permissions.dashboard.view_finance
  const visibleResult = showFinancials ? result : {
    ...result,
    rows: result.rows.map((row) => ({ ...row, debt: 0 })),
    stats: { ...result.stats, debt: 0 },
  }

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
          {club.permissions.clients.export && <ExportClientsButton />}
          {club.permissions.clients.create && <ImportClientsButton />}
          {club.permissions.clients.create && (
            <AddClientButton
              memberships={memberships}
              trainers={trainers}
              initialOpen={one(sp.create) === "1"}
            />
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <ClientsStats stats={visibleResult.stats} showFinancials={showFinancials} />

      {/* Clients table (серверная пагинация) */}
      <ClientsTable
        rows={visibleResult.rows}
        total={visibleResult.total}
        page={visibleResult.page}
        pageSize={visibleResult.pageSize}
        membershipNames={visibleResult.membershipNames}
        showFinancials={showFinancials}
      />
    </div>
  )
}
