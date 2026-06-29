"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, User, Users, AlertTriangle } from "lucide-react"
import { MiniChart } from "./MiniChart"
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

const PERIODS: PeriodKey[] = ["1Ч", "1Д", "7Д", "1М"]

function pct(curr: number, prev: number) {
  if (!prev) return 0
  return ((curr - prev) / prev) * 100
}

export function StatisticsWidget({
  periods,
  activeClients,
  prevClients,
  todayVisits,
  prevVisits,
  alertsCount,
  expiringCount,
  churnCount,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>("1Д")

  const cur = periods[period]
  const todayRevenue = cur.revenue
  const chartData = cur.chart

  const revPct = pct(cur.revenue, cur.prevRevenue)
  const clientPct = pct(activeClients, prevClients)
  const visitPct = pct(todayVisits, prevVisits)

  const revUp = revPct >= 0
  const clientUp = clientPct >= 0
  const visitUp = visitPct >= 0

  function fmt(n: number) {
    return n.toLocaleString("ru-RU")
  }

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <span className="text-2xl font-medium tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
          Статистика
        </span>
        <div className="flex items-center gap-0">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="h-9 px-4 rounded-md text-sm font-medium transition-colors"
              style={{
                background: period === p ? "var(--card-2)" : "transparent",
                color: "var(--on-dark)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex items-stretch gap-5 px-5 pb-5">

        {/* Revenue + mini chart */}
        <div className="flex flex-col w-[420px] xl:w-[520px] flex-shrink-0">
          {/* Text */}
          <div className="flex flex-col gap-3 px-4 py-5">
            <p className="text-base font-normal leading-6" style={{ color: "var(--on-dark-soft)" }}>
              Выручка за {period === "1Д" ? "сегодня" : cur.unit}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-4xl font-medium leading-none tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>
                {fmt(Math.floor(todayRevenue))}
                <span style={{ color: "rgba(2,6,23,0.3)" }}>
                  .{String(Math.round((todayRevenue % 1) * 100)).padStart(2, "0")}
                </span>
              </p>
              <div className="flex items-center gap-1">
                {revUp
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#15803d" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
                }
                <span className="text-sm" style={{ color: revUp ? "#15803d" : "#ef4444" }}>
                  {Math.abs(revPct).toFixed(2)}%
                </span>
              </div>
            </div>
            <p className="text-sm font-normal leading-5" style={{ color: "var(--on-dark-soft)" }}>
              за {cur.unit}
            </p>
          </div>

          {/* Chart */}
          <div className="h-[110px] px-2 pb-2">
            <MiniChart data={chartData} />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch flex-shrink-0" style={{ background: "var(--border)" }} />

        {/* Stat card 1: active clients */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex flex-col gap-4">
            <User className="w-6 h-6" style={{ color: "var(--on-dark-soft)" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
                {fmt(activeClients)} клиентов
              </p>
              <p className="text-sm leading-5" style={{ color: "var(--on-dark-soft)" }}>
                Активных клиентов зала
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4">
            {clientUp
              ? <TrendingUp className="w-4 h-4" style={{ color: "#15803d" }} />
              : <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
            }
            <span className="text-xs" style={{ color: clientUp ? "#15803d" : "#ef4444" }}>
              {Math.abs(clientPct).toFixed(1)}%
            </span>
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
              {" "}больше предыдущего месяца
            </span>
          </div>
        </div>

        {/* Stat card 2: visits today */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex flex-col gap-4">
            <Users className="w-6 h-6" style={{ color: "var(--on-dark-soft)" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
                {fmt(todayVisits)} посещений
              </p>
              <p className="text-sm leading-5" style={{ color: "var(--on-dark-soft)" }}>
                Столько клиентов было за день
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4">
            {visitUp
              ? <TrendingUp className="w-4 h-4" style={{ color: "#15803d" }} />
              : <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
            }
            <span className="text-xs" style={{ color: visitUp ? "#15803d" : "#ef4444" }}>
              {Math.abs(visitPct).toFixed(1)}%
            </span>
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
              {" "}{visitUp ? "больше" : "меньше"} предыдущего дня
            </span>
          </div>
        </div>

        {/* Stat card 3: alerts */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex flex-col gap-4">
            <AlertTriangle className="w-6 h-6" style={{ color: "var(--on-dark-soft)" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
                {alertsCount}
              </p>
              <p className="text-sm leading-5" style={{ color: "var(--on-dark-soft)" }}>
                Требуют внимания
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <span className="text-sm underline cursor-pointer" style={{ color: "#1d4ed8" }}>
              {expiringCount} абонементов истекают
            </span>
            <span className="text-sm underline cursor-pointer" style={{ color: "#1d4ed8" }}>
              {churnCount} клиента в зоне риска
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
