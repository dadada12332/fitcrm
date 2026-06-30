import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getVisitsKPI, getTodayVisits } from "@/lib/visits"
import { VisitsQuickCheckin } from "@/components/app/VisitsQuickCheckin"
import { VisitsTable } from "@/components/app/VisitsTable"
import { UserCheck, Users, UserX, TrendingUp, Plus } from "lucide-react"
import { redirect } from "next/navigation"

export default async function VisitsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  const [kpi, visits] = await Promise.all([
    getVisitsKPI(supabase, club.clubId),
    getTodayVisits(supabase, club.clubId),
  ])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Посещения</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Быстрый check-in и журнал посещений</p>
        </div>
        <button
          className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 text-white transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: "#2563eb" }}
        >
          <Plus className="w-4 h-4" />
          Отметить вручную
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Посещений сегодня", value: kpi.today,              icon: UserCheck },
          { label: "Сейчас в зале",     value: kpi.inGym,              icon: Users },
          { label: "Не пришли сегодня", value: kpi.missedToday,        icon: UserX },
          { label: "Средняя загрузка",  value: `${kpi.avgLoad}%`,      icon: TrendingUp },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Quick check-in */}
      <div className="rounded-lg p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium mb-3" style={{ color: "var(--gray-muted)" }}>
          БЫСТРЫЙ CHECK-IN — введите имя или телефон, нажмите на клиента
        </p>
        <VisitsQuickCheckin />
      </div>

      {/* Visits table */}
      <VisitsTable rows={visits} />
    </div>
  )
}
