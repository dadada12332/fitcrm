"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts"

type DayData = { day: string; value: number }

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  labelStyle: { color: "var(--gray-muted)", marginBottom: 2 },
  itemStyle: { color: "var(--on-dark)", fontWeight: 600 },
  cursor: { fill: "rgba(0,0,0,0.04)" },
}

export function RevenueChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180} initialDimension={{ width: 480, height: 180 }}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--gray-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--gray-muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, ""]}
          separator=""
        />
        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function VisitsChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180} initialDimension={{ width: 480, height: 180 }}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--gray-muted)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--gray-muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} посещ.`, ""]}
          separator=""
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#2563eb" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function RenewalsChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180} initialDimension={{ width: 480, height: 180 }}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--gray-muted)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--gray-muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} абон.`, ""]}
          separator=""
        />
        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
