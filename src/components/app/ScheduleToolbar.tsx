"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toISODate, type Room, type ScheduleView } from "@/lib/schedule"

const inputCls = "h-9 rounded-md px-3 text-sm outline-none"
const inputStyle = { background: "white", border: "1px solid #e2e8f0", color: "#020617" } as const

const VIEWS: { key: ScheduleView; label: string }[] = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
]

export function ScheduleToolbar({
  view, date, trainer, room, rooms, trainers,
}: {
  view: ScheduleView; date: string; trainer: string; room: string; rooms: Room[]; trainers: string[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v); else sp.delete(k)
    }
    router.push(`/schedule?${sp.toString()}`)
  }

  function shift(dir: number) {
    const d = new Date(date + "T00:00:00")
    if (view === "day") d.setDate(d.getDate() + dir)
    else if (view === "week") d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    push({ date: toISODate(d) })
  }

  const anchor = new Date(date + "T00:00:00")
  const label = view === "month"
    ? anchor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    : anchor.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-50" style={{ border: "1px solid #e2e8f0", color: "#475569" }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => push({ date: toISODate(new Date()) })} className="h-9 px-3 rounded-md text-sm font-medium hover:bg-slate-50" style={{ border: "1px solid #e2e8f0", color: "#334155" }}>
            Сегодня
          </button>
          <button onClick={() => shift(1)} className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-50" style={{ border: "1px solid #e2e8f0", color: "#475569" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm font-medium capitalize" style={{ color: "#020617" }}>{label}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* view switcher */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: "#f1f5f9" }}>
          {VIEWS.map((v) => {
            const active = v.key === view
            return (
              <button key={v.key} onClick={() => push({ view: v.key })}
                className="h-8 px-3 rounded-md text-sm font-medium transition-colors"
                style={active ? { background: "white", color: "#020617", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { background: "transparent", color: "#64748b" }}>
                {v.label}
              </button>
            )
          })}
        </div>

        <select value={trainer} onChange={(e) => push({ trainer: e.target.value })} className={inputCls} style={inputStyle}>
          <option value="">Все тренеры</option>
          {trainers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={room} onChange={(e) => push({ room: e.target.value })} className={inputCls} style={inputStyle}>
          <option value="">Все залы</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
    </div>
  )
}
