"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { PlatformDailyMetric } from "@/lib/platform"

function day(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
}

const tooltipStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
}

export function PlatformAnalyticsCharts({ data }: { data: PlatformDailyMetric[] }) {
  if (data.length < 2) {
    return (
      <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Сегодня создан первый исторический снимок. Графики появятся после следующего ежедневного замера.
      </div>
    )
  }
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">MRR и дневная выручка</p>
        <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 480, height: 220 }}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="platformRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={day} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => day(String(value))} formatter={(value, name) => [Number(value).toLocaleString("ru-RU") + " сум", name === "mrr" ? "MRR" : "Выручка"]} />
            <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#platformRevenue)" strokeWidth={2} />
            <Line type="monotone" dataKey="mrr" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">Платные, Trial и новые клубы</p>
        <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 480, height: 220 }}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={day} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => day(String(value))} />
            <Line type="monotone" dataKey="paidClubs" name="Платные" stroke="var(--primary)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="trialClubs" name="Trial" stroke="var(--chart-3)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="newClubs" name="Новые" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
