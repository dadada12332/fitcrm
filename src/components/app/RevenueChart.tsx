"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts"
import type { PeriodKey, PeriodStat } from "@/lib/dashboard"

const PERIODS: PeriodKey[] = ["1Ч", "1Д", "7Д", "1М"]

function pct(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

export function RevenueChart({ periods }: { periods: Record<PeriodKey, PeriodStat> }) {
  const [period, setPeriod] = useState<PeriodKey>("1М")
  const cur = periods[period]
  const revPct = pct(cur.revenue, cur.prevRevenue)
  const up = revPct >= 0

  return (
    <div className="rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* KPI header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ letterSpacing: "0.06em" }}>
            Выручка · {period === "1Д" ? "сегодня" : `за ${cur.unit}`}
          </p>
          <div className="flex items-end gap-2.5 mt-1.5">
            <span className="font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50" style={{ fontSize: 28, lineHeight: 1 }}>
              {Math.round(cur.revenue).toLocaleString("ru-RU")}
              <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500 ml-1.5">сум</span>
            </span>
            <div className="flex items-center gap-1 mb-0.5">
              {up
                ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                : <TrendingDown className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />
              }
              <span className="text-sm font-semibold" style={{ color: up ? "#16a34a" : "#dc2626" }}>
                {up ? "+" : ""}{revPct.toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">vs пред.</span>
            </div>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${
                period === p
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Area chart */}
      <div style={{ height: 220, paddingBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={cur.chart}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--border)"
              horizontal={true}
              vertical={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--gray-muted)" }}
              width={36}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(0)}M`
                  : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : String(v)
              }
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--gray-muted)" }}
              interval="preserveStartEnd"
            />

            <Tooltip
              formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, ""]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
              labelStyle={{ color: "var(--on-dark-soft)", fontWeight: 500 }}
              itemStyle={{ color: "var(--on-dark)", fontWeight: 600 }}
              separator=""
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#revGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
