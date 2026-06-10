"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, User, Users, AlertTriangle, MoreVertical } from "lucide-react"
import { MiniChart } from "./MiniChart"

type ChartPoint = { value: number }

type Props = {
  todayRevenue: number
  prevRevenue: number
  activeClients: number
  prevClients: number
  todayVisits: number
  prevVisits: number
  alertsCount: number
  expiringCount: number
  churnCount: number
  chartData: ChartPoint[]
}

const PERIODS = ["1H", "1D", "7D", "1M"] as const

function pct(curr: number, prev: number) {
  if (!prev) return 0
  return ((curr - prev) / prev) * 100
}

export function StatisticsWidget({
  todayRevenue,
  prevRevenue,
  activeClients,
  prevClients,
  todayVisits,
  prevVisits,
  alertsCount,
  expiringCount,
  churnCount,
  chartData,
}: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1D")

  const revPct = pct(todayRevenue, prevRevenue)
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
      className="w-full rounded-2xl overflow-hidden"
      style={{ background: "white", border: "1px solid #e2e8f0" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <span className="text-2xl font-medium tracking-[-0.144px]" style={{ color: "#020617" }}>
          Статистика
        </span>
        <div className="flex items-center gap-0">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="h-9 px-4 rounded-md text-sm font-medium transition-colors"
              style={{
                background: period === p ? "#f1f5f9" : "transparent",
                color: "#020617",
              }}
            >
              {p}
            </button>
          ))}
          <button className="w-9 h-9 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-stretch gap-5 px-5 pb-5">

        {/* Revenue + mini chart */}
        <div className="flex flex-col w-[340px] flex-shrink-0">
          {/* Text */}
          <div className="flex flex-col gap-3 px-4 py-5">
            <p className="text-base font-normal leading-6" style={{ color: "#64748b" }}>
              Выручка за сегодня
            </p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-medium leading-none tracking-[-0.27px]" style={{ color: "#020617" }}>
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
            <p className="text-sm font-normal leading-5" style={{ color: "#64748b" }}>
              за {period === "1H" ? "час" : period === "1D" ? "день" : period === "7D" ? "неделю" : "месяц"}
            </p>
          </div>

          {/* Chart */}
          <div className="h-[110px] px-2 pb-2">
            <MiniChart data={chartData} />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch flex-shrink-0" style={{ background: "#e2e8f0" }} />

        {/* Stat card 1: active clients */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div className="flex flex-col gap-4">
            <User className="w-6 h-6" style={{ color: "#64748b" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "#020617" }}>
                {fmt(activeClients)} клиентов
              </p>
              <p className="text-sm leading-5" style={{ color: "#64748b" }}>
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
            <span className="text-xs" style={{ color: "#64748b" }}>
              {" "}больше предыдущего месяца
            </span>
          </div>
        </div>

        {/* Stat card 2: visits today */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div className="flex flex-col gap-4">
            <Users className="w-6 h-6" style={{ color: "#64748b" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "#020617" }}>
                {fmt(todayVisits)} посещений
              </p>
              <p className="text-sm leading-5" style={{ color: "#64748b" }}>
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
            <span className="text-xs" style={{ color: "#64748b" }}>
              {" "}{visitUp ? "больше" : "меньше"} предыдущего дня
            </span>
          </div>
        </div>

        {/* Stat card 3: alerts */}
        <div
          className="flex flex-col justify-between flex-1 min-w-0 p-6 rounded-lg"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div className="flex flex-col gap-4">
            <AlertTriangle className="w-6 h-6" style={{ color: "#64748b" }} />
            <div className="flex flex-col gap-1.5">
              <p className="text-2xl font-medium leading-8 tracking-[-0.144px]" style={{ color: "#020617" }}>
                {alertsCount}
              </p>
              <p className="text-sm leading-5" style={{ color: "#64748b" }}>
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
