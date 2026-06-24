import { createClient } from "@/lib/supabase/server"
import { getVisitsKPI, getTodayVisits } from "@/lib/visits"
import { VisitsQuickCheckin } from "@/components/app/VisitsQuickCheckin"
import { VisitsTable } from "@/components/app/VisitsTable"
import { UserCheck, Users, UserX, TrendingUp, Plus } from "lucide-react"

function KPICard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: typeof UserCheck
  color: string
}) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center gap-4"
      style={{ background: "white", border: "1px solid #e2e8f0" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + "18" }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: "#020617" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</p>
      </div>
    </div>
  )
}

export default async function VisitsPage() {
  const supabase = await createClient()
  const [kpi, visits] = await Promise.all([
    getVisitsKPI(supabase),
    getTodayVisits(supabase),
  ])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "#020617" }}>Посещения</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>Быстрый check-in и журнал посещений</p>
        </div>
        <button
          className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2 text-white transition-opacity hover:opacity-90"
          style={{ background: "#2563eb" }}
        >
          <Plus className="w-4 h-4" />
          Отметить вручную
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Посещений сегодня" value={kpi.today} icon={UserCheck} color="#2563eb" />
        <KPICard label="Сейчас в зале" value={kpi.inGym} icon={Users} color="#059669" />
        <KPICard label="Не пришли сегодня" value={kpi.missedToday} icon={UserX} color="#dc2626" />
        <KPICard label="Средняя загрузка" value={`${kpi.avgLoad}%`} icon={TrendingUp} color="#d97706" />
      </div>

      {/* Quick check-in */}
      <div className="rounded-xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <p className="text-xs font-medium mb-3" style={{ color: "#94a3b8" }}>
          БЫСТРЫЙ CHECK-IN — введите имя или телефон, нажмите на клиента
        </p>
        <VisitsQuickCheckin />
      </div>

      {/* Visits table */}
      <VisitsTable rows={visits} />
    </div>
  )
}
