import { CalendarDays, Users, Gauge, XCircle } from "lucide-react"
import type { ScheduleKPIs as KPIs } from "@/lib/schedule"

export function ScheduleKPIs({ kpis }: { kpis: KPIs }) {
  const cards = [
    { label: "Сегодня занятий", value: String(kpis.classes), icon: CalendarDays },
    { label: "Записано клиентов", value: String(kpis.booked), icon: Users },
    { label: "Средняя заполняемость", value: `${kpis.avgFill}%`, icon: Gauge },
    { label: "Отмены", value: String(kpis.cancellations), icon: XCircle },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {cards.map(({ label, value, icon: Icon }, i) => (
        <div key={label} className="p-5 flex flex-col gap-3" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div className="flex items-start justify-between">
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
            <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
          </div>
          <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
