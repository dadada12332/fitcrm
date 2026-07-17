import { getPlatformOverview, PLAN_LABELS } from "@/lib/platform"
import { Panel, PageHeader, StatTile, fmtNum, fmtSum, PT } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const o = await getPlatformOverview()

  const paidClubs = o.activeClubs
  const arpu = paidClubs > 0 ? o.mrr / paidClubs : 0
  const trialConv = (o.trialClubs + paidClubs) > 0 ? (paidClubs / (o.trialClubs + paidClubs)) * 100 : 0
  const avgClients = o.totalClubs > 0 ? o.totalClients / o.totalClubs : 0
  const ltv = arpu * 12 // упрощённо: ARPU × 12 мес

  const metrics = [
    { label: "MRR", value: fmtSum(o.mrr), accent: "var(--chart-2)" },
    { label: "ARR", value: fmtSum(o.arr), accent: "var(--chart-2)" },
    { label: "ARPU", value: fmtSum(arpu) },
    { label: "LTV (≈12 мес)", value: fmtSum(ltv) },
    { label: "Trial → Paid", value: `${trialConv.toFixed(1)}%`, accent: "var(--brand)" },
    { label: "Активных клубов", value: fmtNum(paidClubs) },
    { label: "Trial-клубов", value: fmtNum(o.trialClubs) },
    { label: "Ср. клиентов/клуб", value: avgClients.toFixed(1) },
  ]

  const maxPlan = Math.max(1, ...o.planBreakdown.map((p) => p.count))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Аналитика SaaS" subtitle="Ключевые метрики роста и монетизации" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {metrics.map((m, i) => <StatTile key={i} label={m.label} value={m.value} accent={m.accent} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <span className="text-sm font-semibold text-foreground">Распределение по тарифам</span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {o.planBreakdown.map((p) => (
              <div key={p.plan}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: PT.text }}>{PLAN_LABELS[p.plan] ?? p.plan}</span>
                  <span className="text-sm tabular-nums" style={{ color: PT.textSoft }}>{p.count}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(p.count / maxPlan) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <span className="text-sm font-semibold text-foreground">Операционные показатели</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <StatTile label="Всего клиентов" value={fmtNum(o.totalClients)} />
            <StatTile label="Пользователей" value={fmtNum(o.totalUsers)} />
            <StatTile label="Визитов за 30д" value={fmtNum(o.visits30)} />
            <StatTile label="Выручка клубов 30д" value={fmtSum(o.revenue30)} />
          </div>
        </Panel>
      </div>

      <p className="text-xs mt-4" style={{ color: PT.textMuted }}>
        MRR рассчитан по активным платным подпискам (Starter $29 / Standard $59 / Business $99).
        Графики роста (когорты, retention, churn во времени) появятся после накопления истории событий.
      </p>
    </div>
  )
}
