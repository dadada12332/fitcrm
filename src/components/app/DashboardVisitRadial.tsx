"use client"

import Link from "next/link"
import { TrendingUp, BarChart2 } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

type Props = {
  todayVisits: number
  activeClients: number
  attendanceChangePct: number
}

export function DashboardVisitRadial({ todayVisits, activeClients, attendanceChangePct }: Props) {
  const pct = activeClients > 0 ? Math.min(100, Math.round((todayVisits / activeClients) * 100)) : 0
  const up = attendanceChangePct >= 0

  // Donut data: filled vs remainder
  const data = [
    { value: pct },
    { value: Math.max(0, 100 - pct) },
  ]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), 0, 1)
  const monthEnd = new Date(now.getFullYear(), 6, 1)
  const monthRange = `${monthStart.toLocaleDateString("ru-RU", { month: "long" })} – ${new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}`

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 395, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)" }}
    >
      {/* Tab header */}
      <div
        className="flex items-center justify-between px-3 h-[45px]"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: "var(--gray-muted)" }} />
          <span className="text-xs font-normal" style={{ color: "var(--gray-muted)" }}>График</span>
        </div>
        <Link
          href="/visits"
          className="flex items-center justify-center px-2 h-6 rounded text-xs font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          style={{ border: "1px solid var(--border)", color: "var(--on-dark)", background: "var(--card)", borderRadius: 6 }}
        >
          Подробнее
        </Link>
      </div>

      {/* Card body */}
      <div
        className="flex flex-col overflow-hidden rounded-b-lg"
        style={{ border: "1px solid var(--border)", borderTop: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
      >
        {/* Title */}
        <div className="flex flex-col items-center justify-center gap-0 px-6 pt-6 pb-0">
          <p className="text-[16px] font-medium text-center" style={{ color: "var(--on-dark)", lineHeight: "24px" }}>
            График посещений
          </p>
          <p className="text-[14px] font-normal text-center mt-0.5" style={{ color: "var(--gray-muted)", lineHeight: "20px" }}>
            {monthRange}
          </p>
        </div>

        {/* Radial chart */}
        <div className="flex items-center justify-center px-6 py-2" style={{ height: 222 }}>
          <div className="relative" style={{ width: 221, height: 222 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={90}
                  startAngle={220}
                  endAngle={-40}
                  dataKey="value"
                  strokeWidth={0}
                  paddingAngle={0}
                >
                  <Cell fill="#f97316" />
                  <Cell fill="var(--card-2)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ pointerEvents: "none" }}
            >
              <p className="text-[30px] font-semibold tracking-[-0.225px]" style={{ color: "var(--on-dark)", lineHeight: "36px" }}>
                {todayVisits}
              </p>
              <p className="text-[12px] font-normal tracking-[-0.072px]" style={{ color: "var(--gray-muted)", lineHeight: "16px" }}>
                Посещений
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 px-6 pb-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 justify-center w-full">
            <p className="text-[14px] font-medium text-center" style={{ color: "var(--on-dark)", lineHeight: "20px", letterSpacing: "-0.084px" }}>
              {up ? `Посещаемость выросла на ${Math.abs(attendanceChangePct).toFixed(0)}%` : `Посещаемость снизилась на ${Math.abs(attendanceChangePct).toFixed(0)}%`}
            </p>
            <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: up ? "#16a34a" : "#dc2626" }} />
          </div>
          <p className="text-[14px] font-normal text-center w-full" style={{ color: "var(--gray-muted)", lineHeight: "20px" }}>
            {todayVisits} из {activeClients} активных клиентов сегодня
          </p>
        </div>
      </div>
    </div>
  )
}
