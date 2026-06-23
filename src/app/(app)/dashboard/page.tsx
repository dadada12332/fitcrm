import { createClient } from "@/lib/supabase/server"
import { getDashboardData } from "@/lib/dashboard"
import { StatisticsWidget } from "@/components/app/StatisticsWidget"
import { ExportButton } from "@/components/app/ExportButton"
import { QuickActions } from "@/components/app/QuickActions"
import { ClubAnalytics } from "@/components/app/ClubAnalytics"
import { NewClients } from "@/components/app/NewClients"
import { AiBar } from "@/components/app/AiBar"

export default async function DashboardPage() {
  const supabase = await createClient()
  const d = await getDashboardData(supabase)

  // Clients progress bar data
  const attended = d.todayVisits
  const total = d.activeClients || 1
  const attendedPct = Math.round((attended / total) * 100)
  const expiringPct = Math.round((d.expiringCount / total) * 100)
  const restPct = Math.max(0, 100 - attendedPct - expiringPct)
  const notCame = Math.max(0, d.activeClients - attended - d.expiringCount)

  // Rough potential loss estimate (placeholder until subscriptions carry prices)
  const potentialLoss = d.expiringCount * 700000

  return (
    <div className="space-y-3">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "#020617" }}>
          Дашборд
        </h1>
        <div className="flex items-center gap-3">
          <ExportButton />
          <QuickActions />
        </div>
      </div>

      {/* ── Клиенты progress card ── */}
      <div className="w-full rounded-lg p-6 flex flex-col gap-6" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between">
          <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "#020617" }}>Клиенты</span>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#16a34a" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>{attended} Пришли</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#ffb700" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>{d.expiringCount} Ожидаются</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#dc2626" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>{notCame} Не пришли</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 h-1 w-full rounded-lg overflow-hidden">
          {attendedPct > 0 && <div className="h-full rounded-lg" style={{ background: "#16a34a", width: `${attendedPct}%` }} />}
          {expiringPct > 0 && <div className="h-full rounded-lg ml-0.5" style={{ background: "#ffb700", width: `${expiringPct}%` }} />}
          {restPct > 0 && <div className="h-full rounded-lg ml-0.5" style={{ background: "#dc2626", width: `${restPct}%` }} />}
        </div>
      </div>

      {/* ── Статистика ── */}
      <StatisticsWidget
        periods={d.periods}
        activeClients={d.activeClients}
        prevClients={d.prevClients}
        todayVisits={d.todayVisits}
        prevVisits={d.prevVisits}
        alertsCount={d.alertsCount}
        expiringCount={d.expiringCount}
        churnCount={d.churnCount}
      />

      {/* ── Аналитика клуба + Новые клиенты ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_345px] gap-5 items-stretch">
        <div className="flex flex-col gap-5">
          <ClubAnalytics
            attendanceChangePct={d.attendanceChangePct}
            churnCount={d.churnCount}
            expiringCount={d.expiringCount}
            potentialLoss={potentialLoss}
          />
          <AiBar />
        </div>
        <NewClients clients={d.newClients} />
      </div>

    </div>
  )
}
