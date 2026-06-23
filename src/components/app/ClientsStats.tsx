import { Users, BadgeCheck, CalendarClock, Wallet, TrendingUp, TrendingDown } from "lucide-react"
import type { ClientsStats as Stats } from "@/lib/clients"

function fmt(n: number) {
  return n.toLocaleString("ru-RU")
}

export function ClientsStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Всего клиентов", value: fmt(stats.total), icon: Users, delta: "10.2", pct: "+1.01% this week", up: true },
    { label: "Активные", value: fmt(stats.active), icon: BadgeCheck, delta: "3.1", pct: "+0.49% this week", up: true },
    { label: "Заканчиваются", value: fmt(stats.expiring), icon: CalendarClock, delta: "2.56", pct: "-0.91% this week", up: false },
    { label: "С долгом", value: fmt(stats.debt), icon: Wallet, delta: "7.2", pct: "+1.51% this week", up: true },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
      style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {cards.map(({ label, value, icon: Icon, delta, pct, up }, i) => (
        <div
          key={label}
          className="p-5 flex flex-col gap-3"
          style={{ borderLeft: i === 0 ? "none" : "1px solid #e2e8f0" }}
        >
          <div className="flex items-start justify-between">
            <span className="text-sm" style={{ color: "#64748b" }}>{label}</span>
            <Icon className="w-5 h-5" style={{ color: "#94a3b8" }} />
          </div>
          <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "#020617" }}>{value}</span>
          <div className="flex items-center gap-1.5">
            {up
              ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
              : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
            <span className="text-xs font-medium" style={{ color: up ? "#16a34a" : "#dc2626" }}>{delta}</span>
            <span className="text-xs" style={{ color: "#94a3b8" }}>{pct}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
