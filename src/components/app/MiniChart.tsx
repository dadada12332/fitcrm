"use client"

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"

type Props = { data: { label: string; value: number }[] }

export function MiniChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, ""]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
          labelStyle={{ color: "#64748b", fontWeight: 500, marginBottom: 2 }}
          itemStyle={{ color: "#020617", fontWeight: 600 }}
          separator=""
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#miniGrad)"
          dot={false}
          activeDot={{ r: 3, fill: "#2563eb" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
