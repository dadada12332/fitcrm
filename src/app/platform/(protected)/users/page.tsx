import { getUsersList } from "@/lib/platform"
import { Panel, PageHeader, fmtDate, PT } from "@/components/platform/parts"
import { SearchBox, Pager } from "@/components/platform/ClubsToolbar"

export const dynamic = "force-dynamic"

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0)
  const result = await getUsersList({ search: sp.q, page, pageSize: 30 })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Пользователи" subtitle={`${result.total.toLocaleString("ru-RU")} пользователей SaaS`} />
      <SearchBox placeholder="Поиск по имени или email..." />

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                {["Пользователь", "Email", "Клубы", "Роль", "Платформа", "Регистрация"].map((h, i) => (
                  <th key={i} className="text-left text-[11px] font-medium uppercase px-4 py-2.5 whitespace-nowrap" style={{ color: PT.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-sm" style={{ color: PT.textMuted }}>Пользователи не найдены</td></tr>
              ) : result.rows.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-muted/60" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {(u.fullName ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{u.fullName ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm truncate max-w-[220px]" style={{ color: PT.text }}>{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {u.clubs.length === 0 ? <span className="text-xs" style={{ color: PT.textMuted }}>—</span> :
                        u.clubs.slice(0, 3).map((c, i) => (
                          <span key={i} className="text-[11px] px-1.5 h-5 inline-flex items-center rounded" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.textSoft }}>{c.name}</span>
                        ))}
                      {u.clubs.length > 3 && <span className="text-[11px]" style={{ color: PT.textMuted }}>+{u.clubs.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: PT.textSoft }}>{u.clubs[0]?.role ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.platformRole ? (
                      <span className="inline-flex h-5 items-center rounded-md bg-brand/10 px-2 text-[11px] font-medium text-brand">
                        {u.platformRole === "super_admin" ? "Super Admin" : "Platform Admin"}
                      </span>
                    ) : <span className="text-xs" style={{ color: PT.textMuted }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} />
      </Panel>
    </div>
  )
}
