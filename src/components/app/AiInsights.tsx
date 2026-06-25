"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { TrendingUp, TrendingDown, AlertTriangle, Clock, ArrowUp } from "lucide-react"

type Props = {
  attendanceChangePct: number
  churnCount: number
  expiringCount: number
}

const cards = (attendanceChangePct: number, churnCount: number) => [
  {
    icon: TrendingDown,
    iconColor: "#16a34a",
    lightIconBg: "#dcfce7", darkIconBg: "rgba(22,163,74,0.18)",
    lightBg: "#f0fdf4",     darkBg:  "rgba(22,163,74,0.07)",
    lightBorder: "#bbf7d0", darkBorder: "rgba(22,163,74,0.25)",
    title: "Посещаемость",
    trend: attendanceChangePct,
    desc: attendanceChangePct >= 0
      ? `За 7 дней посещаемость выросла на ${Math.abs(attendanceChangePct).toFixed(0)}%`
      : `За 7 дней посещаемость снизилась на ${Math.abs(attendanceChangePct).toFixed(0)}%`,
  },
  {
    icon: AlertTriangle,
    iconColor: "#7c3aed",
    lightIconBg: "#ede9fe", darkIconBg: "rgba(124,58,237,0.18)",
    lightBg: "#faf5ff",     darkBg:  "rgba(124,58,237,0.07)",
    lightBorder: "#ddd6fe", darkBorder: "rgba(124,58,237,0.25)",
    title: "Риски ухода",
    trend: churnCount > 0 ? -churnCount * 10 : 5,
    desc: churnCount > 0
      ? `${churnCount} клиентов имеют высокий риск ухода`
      : "Риск ухода минимальный",
  },
  {
    icon: Clock,
    iconColor: "#0284c7",
    lightIconBg: "#e0f2fe", darkIconBg: "rgba(2,132,199,0.18)",
    lightBg: "#f0f9ff",     darkBg:  "rgba(2,132,199,0.07)",
    lightBorder: "#bae6fd", darkBorder: "rgba(2,132,199,0.25)",
    title: "Загруженность",
    trend: null,
    desc: "Наиболее загруженное время в зале",
    extra: "18:00 – 21:00",
  },
]

export function AiInsights({ attendanceChangePct, churnCount, expiringCount }: Props) {
  const [chatValue, setChatValue] = useState("")
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const hasText = chatValue.trim().length > 0

  return (
    <div className="rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5">
          <style>{`
            .ai-shimmer-label {
              background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899, #6366f1);
              background-size: 300% 300%;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: ai-shimmer 4s ease infinite;
            }
            @keyframes ai-shimmer {
              0%   { background-position: 0% 50% }
              50%  { background-position: 100% 50% }
              100% { background-position: 0% 50% }
            }
          `}</style>
          <span className="font-semibold ai-shimmer-label" style={{ fontSize: 15 }}>
            ИИ Аналитика
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          За 7 дней
        </span>
      </div>

      {/* 3 horizontal AI cards */}
      <div className="flex overflow-x-auto px-4" style={{ gap: 8, paddingBottom: 0 }}>
        {cards(attendanceChangePct, churnCount).map((card, i) => {
          const Icon = card.icon
          const up = (card.trend ?? 0) >= 0
          return (
            <div
              key={i}
              className="rounded-lg p-3.5 flex flex-col gap-2 flex-shrink-0"
              style={{
                width: 180,
                background: dark ? card.darkBg : card.lightBg,
                border: `1px solid ${dark ? card.darkBorder : card.lightBorder}`,
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: dark ? card.darkIconBg : card.lightIconBg }}>
                <Icon className="w-4 h-4" style={{ color: card.iconColor }} />
              </div>

              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</span>
                  {card.trend !== null && (
                    <div className="flex items-center gap-0.5">
                      {up
                        ? <TrendingUp className="w-3 h-3" style={{ color: "#16a34a" }} />
                        : <TrendingDown className="w-3 h-3" style={{ color: "#dc2626" }} />
                      }
                      <span className="text-xs font-bold" style={{ color: up ? "#16a34a" : "#dc2626" }}>
                        {up ? "+" : ""}{Math.abs(card.trend).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
                {card.extra && (
                  <p className="font-bold mt-1 text-zinc-900 dark:text-zinc-100" style={{ fontSize: 15 }}>
                    {card.extra}
                  </p>
                )}
              </div>

              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{card.desc}</p>

              <button className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors w-fit bg-white/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600">
                Подробнее
              </button>
            </div>
          )
        })}
      </div>

      {/* Chat input */}
      <div className="px-4 pb-4 pt-3 border-t border-zinc-100 dark:border-zinc-800" style={{ marginTop: 12 }}>
        <div className="flex items-center gap-2 rounded-lg px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <span className="text-base flex-shrink-0 select-none">✨</span>
          <input
            value={chatValue}
            onChange={(e) => setChatValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && hasText) setChatValue("") }}
            placeholder="Спросите ИИ о состоянии клуба..."
            className="flex-1 h-10 text-sm bg-transparent outline-none text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
          />
          <button
            onClick={() => { if (hasText) setChatValue("") }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
              hasText ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          >
            <ArrowUp className={`w-3.5 h-3.5 ${hasText ? "text-white dark:text-zinc-900" : "text-zinc-400 dark:text-zinc-500"}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
