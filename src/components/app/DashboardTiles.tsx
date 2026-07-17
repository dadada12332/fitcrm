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
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
      {/* Top row: text + icon */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-normal sm:text-sm" style={{ color: "var(--gray-muted)", lineHeight: "20px" }}>
            {tile.label}
          </p>
          <p className="text-lg font-medium sm:text-[20px]" style={{ color: "var(--on-dark)", lineHeight: "28px" }}>
            {tile.value}
          </p>
        </div>
        <div className="w-6 h-6 flex-shrink-0 mt-0.5">
          {tile.icon}
        </div>
      </div>

      {/* Bottom row: trend */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {up
            ? <TrendingUp className="w-4 h-4" style={{ color: "#15803d" }} />
            : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />
          }
          <span className="text-xs font-normal" style={{ color: up ? "#15803d" : "#dc2626", lineHeight: "16px", letterSpacing: "-0.072px" }}>
            {Math.abs(tile.trend).toFixed(1)}
          </span>
        </div>
        <p className="hidden min-w-0 flex-1 text-xs font-normal sm:block" style={{ color: "var(--gray-muted)", lineHeight: "16px", letterSpacing: "-0.072px" }}>
          {tile.trendLabel}
        </p>
      </div>
    </div>
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

  const borders = [
    "border-b border-r border-border xl:border-b-0",
    "border-b border-border xl:border-r xl:border-b-0",
    "border-r border-border xl:border-r",
    "",
  ]

  return (
    <div
      className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-border xl:grid-cols-4"
      style={{ background: "var(--card)" }}
    >
      {tiles.map((tile, i) => (
        <div key={tile.label} className={borders[i]}>
          <TileComp tile={tile} />
        </div>
      ))}
    </div>
  )
}
