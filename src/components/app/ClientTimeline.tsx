"use client"

import { useState } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import type { PeriodKey, PeriodStat } from "@/lib/dashboard"

export type TimelineVisit = {
  id: string
  clientId: string | null
  clientName: string | null
  clientTags: string[]
  checkedInAt: string
}

type Props = {
  visits: TimelineVisit[]
  periods: Record<PeriodKey, PeriodStat>
  activeClients: number
  todayVisits: number
  expiringCount: number
  churnCount: number
}

const PERIODS: PeriodKey[] = ["1Ч", "1Д", "7Д", "1М"]

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

const AVATAR_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c",
]

export function ClientTimeline({
  visits,
  periods,
  activeClients,
  todayVisits,
  expiringCount,
  churnCount,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>("1Д")
  const cur = periods[period]

  return (
    <div className="rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <span className="font-semibold text-[15px] text-zinc-950 dark:text-zinc-50">
            Последние клиенты
          </span>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {activeClients} активных · {todayVisits} сегодня
          </p>
        </div>
        <div className="flex items-center gap-1">
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
          <button className="ml-1 w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="flex items-center gap-6 px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Выручка · {period === "1Д" ? "сегодня" : `за ${cur.unit}`}
          </p>
          <p className="font-semibold tabular-nums text-[15px] text-zinc-950 dark:text-zinc-50">
            {Math.round(cur.revenue).toLocaleString("ru-RU")} сум
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Истекают</p>
          <p className={`font-semibold text-[15px] ${expiringCount > 0 ? "" : "text-zinc-950 dark:text-zinc-50"}`}
            style={{ color: expiringCount > 0 ? "#d97706" : undefined }}>
            {expiringCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">В риске</p>
          <p className={`font-semibold text-[15px] ${churnCount > 0 ? "" : "text-zinc-950 dark:text-zinc-50"}`}
            style={{ color: churnCount > 0 ? "#dc2626" : undefined }}>
            {churnCount}
          </p>
        </div>
      </div>

      {/* Timeline list */}
      {visits.length === 0 ? (
        <p className="text-sm text-center py-10 text-zinc-400 dark:text-zinc-500">
          Нет посещений
        </p>
      ) : (
        <div className="flex flex-col">
          {visits.map((v, i) => {
            const name = v.clientName ?? "Клиент"
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const tag = v.clientTags?.[0]
            const isLast = i === visits.length - 1

            return (
              <div
                key={v.id}
                className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  isLast ? "" : "border-b border-zinc-50 dark:border-zinc-800"
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: color }}>
                  {initials(name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate text-zinc-950 dark:text-zinc-50">
                      {v.clientId ? (
                        <Link href={`/clients/${v.clientId}`} className="hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </span>
                    {tag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        {tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 text-zinc-400 dark:text-zinc-500">Отметился в клубе</p>
                </div>

                <span className="text-xs flex-shrink-0 text-zinc-400 dark:text-zinc-500">
                  {timeAgo(v.checkedInAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
