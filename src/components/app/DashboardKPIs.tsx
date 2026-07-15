"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, DollarSign, Users, UserCheck, AlertTriangle } from "lucide-react"
import type { PeriodKey, PeriodStat } from "@/lib/dashboard"

type Props = {
  periods: Record<PeriodKey, PeriodStat>
  activeClients: number
  prevClients: number
  todayVisits: number
  prevVisits: number
  alertsCount: number
  expiringCount: number
  churnCount: number
}

const PERIODS: PeriodKey[] = ["Сегодня", "7Д", "30Д", "3М", "Год"]

function pct(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

function Trend({ value }: { value: number }) {
  const up = value >= 0
  return (
    <div className="flex items-center gap-0.5">
      {up
        ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
        : <TrendingDown className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />
      }
      <span className="text-xs font-medium" style={{ color: up ? "#16a34a" : "#dc2626" }}>
        {up ? "+" : ""}{Math.abs(value).toFixed(1)}%
      </span>
    </div>
  )
}

export function DashboardKPIs({
  periods,
  activeClients,
  prevClients,
  todayVisits,
  prevVisits,
  alertsCount,
  expiringCount,
  churnCount,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>("Сегодня")
  const cur = periods[period]

  const revPct = pct(cur.revenue, cur.prevRevenue)
  const clientPct = pct(activeClients, prevClients)
  const visitPct = pct(todayVisits, prevVisits)

  return (
    <div>
      {/* Period tabs */}
      <div className="flex items-center justify-end gap-0.5 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="h-8 px-3 rounded-md text-sm font-medium transition-colors"
            style={{
              background: period === p ? "var(--card-2)" : "transparent",
              color: period === p ? "var(--on-dark)" : "var(--on-dark-soft)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 4 KPI tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Выручка */}
        <div className="rounded-lg p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(37,99,235,0.1)" }}>
              <DollarSign className="w-4 h-4" style={{ color: "#2563eb" }} />
            </div>
            <Trend value={revPct} />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--on-dark)" }}>
              {Math.round(cur.revenue).toLocaleString("ru-RU")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>
              Выручка · {period === "Сегодня" ? "сегодня" : `за ${cur.unit}`}
            </p>
          </div>
        </div>

        {/* Клиенты */}
        <div className="rounded-lg p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(22,163,74,0.1)" }}>
              <Users className="w-4 h-4" style={{ color: "#16a34a" }} />
            </div>
            <Trend value={clientPct} />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--on-dark)" }}>
              {activeClients.toLocaleString("ru-RU")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Активных клиентов</p>
          </div>
        </div>

        {/* Посещения */}
        <div className="rounded-lg p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#fdf4ff" }}>
              <UserCheck className="w-4 h-4" style={{ color: "#9333ea" }} />
            </div>
            <Trend value={visitPct} />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--on-dark)" }}>
              {todayVisits.toLocaleString("ru-RU")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Посещений сегодня</p>
          </div>
        </div>

        {/* Алерты */}
        <div
          className="rounded-lg p-5 flex flex-col gap-3"
          style={{
            background: alertsCount > 0 ? "#fffbeb" : "var(--card)",
            border: `1px solid ${alertsCount > 0 ? "#fde68a" : "var(--border)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: alertsCount > 0 ? "rgba(217,119,6,0.14)" : "var(--card-2)" }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: alertsCount > 0 ? "#d97706" : "var(--on-dark-soft)" }} />
            </div>
            {alertsCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(217,119,6,0.14)", color: "#d97706" }}
              >
                Внимание
              </span>
            )}
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--on-dark)" }}>
              {alertsCount}
            </p>
            <div className="mt-1 flex flex-col gap-0.5">
              {expiringCount > 0 && (
                <p className="text-xs" style={{ color: "#d97706" }}>{expiringCount} абонементов истекают</p>
              )}
              {churnCount > 0 && (
                <p className="text-xs" style={{ color: "#d97706" }}>{churnCount} клиентов в риске</p>
              )}
              {alertsCount === 0 && (
                <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Всё в порядке</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
