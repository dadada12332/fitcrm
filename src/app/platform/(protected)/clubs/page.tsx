import Link from "next/link"
import { Building2 } from "lucide-react"
import { getClubsList, platformBase } from "@/lib/platform"
import {
  Panel, PageHeader, PlanBadge, StatusBadge, HealthBadge,
  fmtNum, fmtDate, timeAgo, PT,
} from "@/components/platform/parts"
import { ClubsToolbar, Pager } from "@/components/platform/ClubsToolbar"

export const dynamic = "force-dynamic"

export default async function ClubsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0)
  const [result, base] = await Promise.all([
    getClubsList({ search: sp.q, status: sp.status, plan: sp.plan, page, pageSize: 25 }),
    platformBase(),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
      <PageHeader
        title="Клубы"
        subtitle={`${result.total.toLocaleString("ru-RU")} клубов на платформе`}
      />

      <ClubsToolbar />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                {["Клуб", "Владелец", "Тариф", "Статус", "Клиентов", "Команда", "Активность", "Оплата", "Health", ""].map((h, i) => (
                  <th key={i} className="text-left text-[11px] font-medium uppercase px-4 py-2.5 whitespace-nowrap" style={{ color: PT.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-sm" style={{ color: PT.textMuted }}>Клубы не найдены</td></tr>
              ) : result.rows.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-muted/60" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                  <td className="px-4 py-3">
                    <Link href={`${base}/clubs/${c.id}`} className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand transition-colors">{c.name}</p>
                        <p className="text-[11px] truncate" style={{ color: PT.textMuted }}>{c.city ?? "—"} · рег. {fmtDate(c.createdAt)}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm truncate max-w-[180px]" style={{ color: PT.text }}>{c.ownerName ?? "—"}</p>
                    <p className="text-[11px] truncate max-w-[180px]" style={{ color: PT.textMuted }}>{c.ownerEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={c.plan} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: PT.text }}>{fmtNum(c.clientsCount)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: PT.text }}>{fmtNum(c.staffCount)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{timeAgo(c.lastActivity)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{timeAgo(c.lastPayment)}</td>
                  <td className="px-4 py-3"><HealthBadge score={c.health} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${base}/clubs/${c.id}`} className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--brand)" }}>
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} />
      </Panel>

      {result.total === 0 && !sp.q && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 mt-4">
          <Building2 className="w-8 h-8" style={{ color: PT.textMuted }} />
          <p className="text-sm" style={{ color: PT.textMuted }}>На платформе пока нет клубов</p>
        </div>
      )}
    </div>
  )
}
