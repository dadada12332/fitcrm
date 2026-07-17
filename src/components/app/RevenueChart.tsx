"use client"

import { useState } from "react"
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts"
import { ChevronDown } from "lucide-react"
import type { PeriodKey, PeriodStat } from "@/lib/dashboard"

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "Сегодня", label: "Сегодня" },
  { key: "7Д",      label: "7 дней"  },
  { key: "30Д",     label: "30 дней" },
  { key: "3М",      label: "3 мес"   },
  { key: "Год",     label: "Год"     },
]

export function RevenueChart({ periods }: { periods: Record<PeriodKey, PeriodStat> }) {
  const [period, setPeriod] = useState<PeriodKey>("7Д")
  const cur = periods[period]

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? period

  return (
    <div
      className="flex flex-col flex-1 min-w-0"
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <p
            className="text-[20px] font-medium tracking-[-0.12px]"
            style={{ color: "var(--on-dark)", lineHeight: "28px" }}
          >
            Выручка · {periodLabel}
          </p>
        </div>

        {/* Period dropdown (decorative) */}
        <div className="flex items-center gap-1.5 relative">
          {/* Pill period buttons */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: "var(--card-2)" }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="h-7 px-3 rounded text-xs font-medium transition-all"
                style={{
                  background: period === p.key ? "var(--pill-active)" : "transparent",
                  color: period === p.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                  boxShadow: period === p.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 340, padding: "12px 0 16px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={cur.chart}
            margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revPrev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--border)"
              horizontal
              vertical={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--gray-muted)", fontFamily: "Inter" }}
              width={48}
              tickFormatter={(v) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M`
                : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
                : String(v)
              }
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--gray-muted)", fontFamily: "Inter" }}
              interval="preserveStartEnd"
            />

            <Tooltip
              formatter={(v, name) => [
                `${Number(v).toLocaleString("ru-RU")} сум`,
                name === "value" ? "Текущий" : "Прошлый"
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                fontFamily: "Inter",
              }}
              labelStyle={{ color: "var(--gray-muted)", fontWeight: 500 }}
              itemStyle={{ color: "var(--on-dark)", fontWeight: 600 }}
            />

            {/* Previous period — dashed, muted */}
            <Area
              type="monotone"
              dataKey="prev"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#revPrev)"
              dot={false}
              activeDot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
            />

            {/* Current period — solid, blue */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#revCurrent)"
              dot={false}
              activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
