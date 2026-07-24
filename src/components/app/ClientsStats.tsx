import { Users, BadgeCheck, CalendarClock, Wallet } from "lucide-react"
import type { ClientsStats as Stats } from "@/lib/clients"

function fmt(n: number) {
  return n.toLocaleString("ru-RU")
}

export function ClientsStats({ stats, showFinancials = true }: { stats: Stats; showFinancials?: boolean }) {
  const cards = [
    { label: "Всего клиентов", value: fmt(stats.total), icon: Users },
    { label: "Активные", value: fmt(stats.active), icon: BadgeCheck },
    { label: "Заканчиваются", value: fmt(stats.expiring), icon: CalendarClock },
    { label: "С долгом", value: fmt(stats.debt), icon: Wallet },
  ].filter((card) => showFinancials || card.label !== "С долгом")

  return (
    <div className={`grid grid-cols-1 gap-0 overflow-hidden rounded-lg sm:grid-cols-2 ${cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {cards.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className="p-5 flex flex-col gap-3"
          style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}
        >
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
