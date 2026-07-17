"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { toISODate, type Room, type ScheduleView } from "@/lib/schedule"
import { RoomsManager } from "./RoomsManager"

const inputCls = "h-9 rounded-md pl-3 pr-8 text-sm outline-none appearance-none w-full"
const inputStyle = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" } as const

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
  const [pending, startTransition] = useTransition()
  const [selView, setSelView] = useState<ScheduleView>(view)   // оптимистичный активный таб

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v); else sp.delete(k)
    }
    // useTransition — навигация не фризит UI, подсветка таба мгновенная
    startTransition(() => router.push(`/schedule?${sp.toString()}`, { scroll: false }))
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
    <div className="flex flex-col items-stretch gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="text-sm font-medium capitalize" style={{ color: "var(--on-dark)" }}>{label}</span>
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <button onClick={() => shift(-1)} className="w-9 h-9 flex shrink-0 items-center justify-center rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => push({ date: toISODate(new Date()) })} className="h-9 flex-1 px-3 text-sm font-medium rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 sm:flex-none" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            Сегодня
          </button>
          <button onClick={() => shift(1)} className="w-9 h-9 flex shrink-0 items-center justify-center rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {/* view switcher */}
        <div className="flex items-center gap-2">
          {pending && <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: "var(--gray-muted)" }} />}
          <div className="flex flex-1 items-center gap-0.5 rounded-md p-0.5 sm:flex-none" style={{ background: "var(--card-2)" }}>
            {VIEWS.map((v) => {
              const active = v.key === selView   // оптимистично: подсветка сразу по клику
              return (
                <button key={v.key} onClick={() => { setSelView(v.key); push({ view: v.key }) }}
                  className="h-8 flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none"
                  style={active ? { background: "var(--card)", color: "var(--on-dark)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { background: "transparent", color: "var(--on-dark-soft)" }}>
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="relative min-w-0">
            <select value={trainer} onChange={(e) => push({ trainer: e.target.value })} className={inputCls} style={inputStyle}>
              <option value="">Все тренеры</option>
              {trainers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
          </div>

          <div className="relative min-w-0">
            <select value={room} onChange={(e) => push({ room: e.target.value })} className={inputCls} style={inputStyle}>
              <option value="">Все залы</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
          </div>
        </div>

        <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
          <RoomsManager rooms={rooms} />
        </div>
      </div>
    </div>
  )
}
