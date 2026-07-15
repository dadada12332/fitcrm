import { Users, CreditCard, Zap, Clock, TrendingUp, TrendingDown } from "lucide-react"

type Tile = {
  label: string
  value: string
  trend: number
  trendLabel: string
  icon: React.ReactNode
}

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU") }

function TileComp({ tile }: { tile: Tile }) {
  const up = tile.trend >= 0
  return (
    <div className="flex flex-1 flex-col gap-6 min-w-0 px-4 py-0">
      {/* Top row: text + icon */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-normal" style={{ color: "var(--gray-muted)", lineHeight: "20px" }}>
            {tile.label}
          </p>
          <p className="text-[20px] font-medium tracking-[-0.12px]" style={{ color: "var(--on-dark)", lineHeight: "28px" }}>
            {tile.value}
          </p>
        </div>
        <div className="w-6 h-6 flex-shrink-0 mt-0.5">
          {tile.icon}
        </div>
      </div>

      {/* Bottom row: trend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {up
            ? <TrendingUp className="w-4 h-4" style={{ color: "#15803d" }} />
            : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />
          }
          <span className="text-xs font-normal" style={{ color: up ? "#15803d" : "#dc2626", lineHeight: "16px", letterSpacing: "-0.072px" }}>
            {Math.abs(tile.trend).toFixed(1)}
          </span>
        </div>
        <p className="text-xs font-normal flex-1 min-w-0" style={{ color: "var(--gray-muted)", lineHeight: "16px", letterSpacing: "-0.072px" }}>
          {tile.trendLabel}
        </p>
      </div>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center justify-center flex-shrink-0 w-px" style={{ height: 102, background: "var(--border)" }} />
  )
}

type Props = {
  activeClients: number
  prevClients: number
  todayRevenue: number
  prevRevenue: number
  todayVisits: number
  prevVisits: number
  expiringCount: number
}

export function DashboardTiles({ activeClients, prevClients, todayRevenue, prevRevenue, todayVisits, prevVisits, expiringCount }: Props) {
  function pct(curr: number, prev: number) {
    if (!prev) return curr > 0 ? 100 : 0
    return ((curr - prev) / prev) * 100
  }

  const revDelta = pct(todayRevenue, prevRevenue)
  const clientDelta = pct(activeClients, prevClients)
  const visitsDelta = pct(todayVisits, prevVisits)

  const tiles: Tile[] = [
    {
      label: "Активных клиентов",
      value: fmt(activeClients),
      trend: clientDelta,
      trendLabel: `${clientDelta >= 0 ? "+" : ""}${clientDelta.toFixed(2)}% эта неделя`,
      icon: <Users className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />,
    },
    {
      label: "Выручка сегодня",
      value: `${fmt(todayRevenue)} сум`,
      trend: revDelta,
      trendLabel: `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(2)}% вчера`,
      icon: <CreditCard className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />,
    },
    {
      label: "Посещений сегодня",
      value: fmt(todayVisits),
      trend: visitsDelta,
      trendLabel: `${visitsDelta >= 0 ? "+" : ""}${visitsDelta.toFixed(2)}% вчера`,
      icon: <Zap className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />,
    },
    {
      label: "Истекает абонемент",
      value: fmt(expiringCount),
      trend: expiringCount > 0 ? -expiringCount : 0,
      trendLabel: expiringCount > 0 ? "требуют продления" : "всё в порядке",
      icon: <Clock className="w-6 h-6" style={{ color: expiringCount > 0 ? "#d97706" : "var(--gray-muted)" }} />,
    },
  ]

  return (
    <div
      className="flex items-center w-full"
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 0" }}
    >
      {tiles.map((tile, i) => (
        <div key={i} className="flex flex-1 min-w-0">
          {i > 0 && <Divider />}
          <TileComp tile={tile} />
        </div>
      ))}
    </div>
  )
}
