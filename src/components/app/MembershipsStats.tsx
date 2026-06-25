import { Users, Box, CheckCircle2, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react"
import type { MembershipsStats as Stats } from "@/lib/memberships"

function fmt(n: number) {
  return n.toLocaleString("ru-RU")
}

export function MembershipsStats({ stats }: { stats: Stats }) {
  const revPct = stats.revenuePrevMonth
    ? Math.round(((stats.revenueThisMonth - stats.revenuePrevMonth) / stats.revenuePrevMonth) * 100)
    : 0

  const cards = [
    {
      label: "Всего тарифов",
      value: fmt(stats.total),
      icon: Users,
      delta: <Up up text="актуальный каталог" />,
    },
    {
      label: "Активных тарифов",
      value: fmt(stats.active),
      icon: Box,
      delta: <Up up text="от всех тарифов" deltaText={`${stats.activePct}%`} />,
    },
    {
      label: "Продано за месяц",
      value: fmt(stats.soldThisMonth),
      icon: CheckCircle2,
      delta: <Up up text="новых абонементов" />,
    },
    {
      label: "Выручка за месяц",
      value: (
        <>
          {fmt(stats.revenueThisMonth)} <span className="text-lg font-normal" style={{ color: "var(--gray-muted)" }}>сум</span>
        </>
      ),
      icon: ArrowUpRight,
      delta: <Up up={revPct >= 0} text="к прошлому месяцу" deltaText={`${revPct >= 0 ? "+" : ""}${revPct}%`} />,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {cards.map(({ label, value, icon: Icon, delta }, i) => (
        <div key={label} className="p-5 flex flex-col gap-3" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div className="flex items-start justify-between">
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
            <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
          </div>
          <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
          {delta}
        </div>
      ))}
    </div>
  )
}

function Up({ up, text, deltaText }: { up: boolean; text: string; deltaText?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {up
        ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
        : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
      {deltaText && <span className="text-xs font-medium" style={{ color: up ? "#16a34a" : "#dc2626" }}>{deltaText}</span>}
      <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{text}</span>
    </div>
  )
}
