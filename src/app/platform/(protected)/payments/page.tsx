import { getPlatformPayments } from "@/lib/platform"
import { Panel, PageHeader, StatTile, fmtSum, timeAgo, PT } from "@/components/platform/parts"
import { Pager } from "@/components/platform/ClubsToolbar"

export const dynamic = "force-dynamic"

const PROVIDER_LABEL: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
const STATUS_STYLE: Record<string, { fg: string; label: string }> = {
  paid:     { fg: "var(--chart-2)", label: "Оплачено" },
  pending:  { fg: "var(--chart-3)", label: "Ожидание" },
  failed:   { fg: "var(--destructive)", label: "Ошибка" },
  refunded: { fg: "var(--muted-foreground)", label: "Возврат" },
}

export default async function PlatformPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0)
  const result = await getPlatformPayments({ page, pageSize: 30, provider: sp.provider })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Платежи" subtitle="Все оплаты по всем клубам платформы" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatTile label="Выручка клубов за 30д" value={fmtSum(result.sum)} accent="var(--chart-2)" />
        <StatTile label="Всего записей" value={result.total.toLocaleString("ru-RU")} />
        <StatTile label="Показано" value={`${result.rows.length}`} />
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                {["Клуб", "Клиент", "Способ", "Статус", "Когда", "Сумма"].map((h, i) => (
                  <th key={i} className={`text-[11px] font-medium uppercase px-4 py-2.5 whitespace-nowrap ${i === 5 ? "text-right" : "text-left"}`} style={{ color: PT.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-sm" style={{ color: PT.textMuted }}>Платежей нет</td></tr>
              ) : result.rows.map((p) => {
                const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                return (
                  <tr key={p.id} className="transition-colors hover:bg-muted/60" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                    <td className="px-4 py-3 text-sm text-foreground truncate max-w-[200px]">{p.clubName ?? "—"}</td>
                    <td className="px-4 py-3 text-sm truncate max-w-[180px]" style={{ color: PT.text }}>{p.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: st.fg }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.fg }} />{st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{timeAgo(p.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-right tabular-nums" style={{ color: p.status === "paid" ? "var(--chart-2)" : PT.text }}>{fmtSum(p.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} />
      </Panel>
    </div>
  )
}
