import Link from "next/link"
import { TrendingUp, TrendingDown, Users, Zap, AlertTriangle, CreditCard } from "lucide-react"

function pct(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU") }

type KPICardProps = {
  label: string
  value: string
  sub: string
  subColor?: string
  trend?: number
  icon: React.ReactNode
  href?: string
  highlight?: "orange" | "red"
}

function KPICard({ label, value, sub, subColor, trend, icon, href, highlight }: KPICardProps) {
  const trendUp = (trend ?? 0) >= 0
  const highlightBg = highlight === "red" ? "rgba(220,38,38,0.05)" : highlight === "orange" ? "rgba(217,119,6,0.05)" : undefined
  const highlightBorder = highlight === "red" ? "rgba(220,38,38,0.2)" : highlight === "orange" ? "rgba(217,119,6,0.2)" : "var(--border)"

  const inner = (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-colors hover:bg-opacity-80"
      style={{ background: highlightBg ?? "var(--card)", border: `1px solid ${highlightBorder}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--card-2)" }}>
          {icon}
        </span>
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums leading-none" style={{ color: "var(--on-dark)" }}>
          {value}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend !== undefined && (
            <>
              {trendUp
                ? <TrendingUp className="w-3 h-3" style={{ color: "#16a34a" }} />
                : <TrendingDown className="w-3 h-3" style={{ color: "#dc2626" }} />
              }
              <span className="text-xs font-semibold" style={{ color: trendUp ? "#16a34a" : "#dc2626" }}>
                {trendUp ? "+" : ""}{Math.abs(trend ?? 0).toFixed(1)}%
              </span>
            </>
          )}
          <span className="text-xs" style={{ color: subColor ?? "var(--on-dark-soft)" }}>{sub}</span>
        </div>
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

type Props = {
  todayRevenue: number
  prevRevenue: number
  activeClients: number
  todayNewClients: number
  todayVisits: number
  expiringCount: number
  debtCount: number
  debtTotal: number
  isEmpty: boolean
}

export function DashboardKPIRow({
  todayRevenue, prevRevenue, activeClients, todayNewClients,
  todayVisits, expiringCount, debtCount, debtTotal, isEmpty,
}: Props) {
  if (isEmpty) return null

  const revPct = pct(todayRevenue, prevRevenue)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPICard
        label="Выручка сегодня"
        value={`${fmt(todayRevenue)} сум`}
        sub={`vs вчера (${fmt(prevRevenue)} сум)`}
        trend={revPct}
        icon={<CreditCard className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
      />
      <KPICard
        label="Активных клиентов"
        value={fmt(activeClients)}
        sub={todayNewClients > 0 ? `+${todayNewClients} сегодня` : "чел."}
        subColor={todayNewClients > 0 ? "#16a34a" : undefined}
        icon={<Users className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
        href="/clients"
      />
      <KPICard
        label="Посещений сегодня"
        value={fmt(todayVisits)}
        sub="человек"
        icon={<Zap className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
        href="/visits"
      />
      <KPICard
        label="Истекает абонемент"
        value={fmt(expiringCount)}
        sub={expiringCount > 0 ? "требуют продления" : "всё в порядке"}
        subColor={expiringCount > 0 ? "#d97706" : undefined}
        icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: expiringCount > 0 ? "#d97706" : "var(--gray-muted)" }} />}
        href="/clients"
        highlight={expiringCount > 0 ? "orange" : undefined}
      />
      <KPICard
        label="Задолженность"
        value={debtTotal > 0 ? `${fmt(debtTotal)} сум` : "0 сум"}
        sub={debtCount > 0 ? `${debtCount} клиентов` : "нет долгов"}
        subColor={debtCount > 0 ? "#dc2626" : undefined}
        icon={<CreditCard className="w-3.5 h-3.5" style={{ color: debtCount > 0 ? "#dc2626" : "var(--gray-muted)" }} />}
        href="/clients"
        highlight={debtCount > 0 ? "red" : undefined}
      />
    </div>
  )
}
