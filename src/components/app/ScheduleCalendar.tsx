"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { fillColor, toISODate, type ClassItem, type ScheduleData } from "@/lib/schedule"
import { ClassDrawer } from "./ClassDrawer"

type ClientOpt = { id: string; name: string }

function pad(n: number) { return String(n).padStart(2, "0") }

function ClassCard({ cls, onClick, showRoom }: { cls: ClassItem; onClick: () => void; showRoom?: boolean }) {
  const c = fillColor(cls.fill, cls.status)
  const cancelled = cls.status === "cancelled"
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-md px-2 py-1.5 transition-transform hover:scale-[1.01]"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold truncate" style={{ color: c.text, textDecoration: cancelled ? "line-through" : "none" }}>{cls.title}</span>
        <span className="text-[11px] font-medium flex-shrink-0" style={{ color: c.text }}>
          {cancelled ? "отм." : `${cls.seatsBooked}/${cls.seatsTotal}`}
        </span>
      </div>
      <div className="text-[11px] truncate" style={{ color: c.text, opacity: 0.85 }}>
        {cls.startTime}–{cls.endTime}{showRoom ? ` · ${cls.roomName}` : ` · ${cls.trainerName}`}
      </div>
    </button>
  )
}

export function ScheduleCalendar({ data, clients }: { data: ScheduleData; clients: ClientOpt[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => data.classes.find((c) => c.id === selectedId) ?? null, [data.classes, selectedId])

  // диапазон часов
  const hours = useMemo(() => {
    const hs = data.classes.map((c) => c.startHour).filter((h) => h > 0)
    const from = Math.min(8, hs.length ? Math.min(...hs) : 8)
    const to = Math.max(21, hs.length ? Math.max(...hs) : 21)
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  }, [data.classes])

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {data.view === "day" && <DayGrid data={data} hours={hours} onPick={setSelectedId} />}
      {data.view === "week" && <WeekGrid data={data} hours={hours} onPick={setSelectedId} />}
      {data.view === "month" && <MonthGrid data={data} onPick={setSelectedId} />}

      <ClassDrawer cls={selected} clients={clients} onClose={() => setSelectedId(null)} />
    </div>
  )
}

/* ── День: Время × Залы ── */
function DayGrid({ data, hours, onPick }: { data: ScheduleData; hours: number[]; onPick: (id: string) => void }) {
  const rooms = data.rooms
  const dayClasses = data.classes.filter((c) => c.date === data.date)
  const cols = `72px repeat(${rooms.length}, minmax(0,1fr))`

  return (
    <div style={{ display: "grid", gridTemplateColumns: cols }}>
      <div className="h-11 flex items-center px-3 text-sm" style={{ color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>Время</div>
      {rooms.map((r) => (
        <div key={r.id} className="h-11 flex items-center px-3 text-sm font-medium" style={{ color: "var(--on-dark)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", background: "var(--bg)" }}>{r.name}</div>
      ))}

      {hours.map((h) => (
        <DayRow key={h} hour={h} rooms={rooms} classes={dayClasses} onPick={onPick} />
      ))}
    </div>
  )
}

function DayRow({ hour, rooms, classes, onPick }: { hour: number; rooms: ScheduleData["rooms"]; classes: ClassItem[]; onPick: (id: string) => void }) {
  return (
    <>
      <div className="min-h-[60px] flex items-start justify-end px-2 py-1.5 text-xs" style={{ color: "var(--gray-muted)", borderBottom: "1px solid var(--border-subtle)" }}>{pad(hour)}:00</div>
      {rooms.map((r) => {
        const items = classes.filter((c) => c.roomId === r.id && c.startHour === hour)
        return (
          <div key={r.id} className="min-h-[60px] p-1 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--border-subtle)", borderLeft: "1px solid var(--border-subtle)" }}>
            {items.map((c) => <ClassCard key={c.id} cls={c} onClick={() => onPick(c.id)} />)}
          </div>
        )
      })}
    </>
  )
}

/* ── Неделя: Время × Дни ── */
function WeekGrid({ data, hours, onPick }: { data: ScheduleData; hours: number[]; onPick: (id: string) => void }) {
  const days = useMemo(() => {
    const start = new Date(data.rangeStart + "T00:00:00")
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  }, [data.rangeStart])
  const cols = `72px repeat(7, minmax(0,1fr))`

  return (
    <div className="overflow-x-auto">
      <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: 760 }}>
        <div className="h-11 flex items-center px-3 text-sm" style={{ color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>Время</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="h-11 flex items-center px-3 text-sm font-medium capitalize" style={{ color: "var(--on-dark)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", background: "var(--bg)" }}>
            {d.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit" })}
          </div>
        ))}

        {hours.map((h) => (
          <WeekRow key={h} hour={h} days={days} classes={data.classes} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

function WeekRow({ hour, days, classes, onPick }: { hour: number; days: Date[]; classes: ClassItem[]; onPick: (id: string) => void }) {
  return (
    <>
      <div className="min-h-[56px] flex items-start justify-end px-2 py-1.5 text-xs" style={{ color: "var(--gray-muted)", borderBottom: "1px solid var(--border-subtle)" }}>{pad(hour)}:00</div>
      {days.map((d) => {
        const iso = toISODate(d)
        const items = classes.filter((c) => c.date === iso && c.startHour === hour)
        return (
          <div key={iso} className="min-h-[56px] p-1 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--border-subtle)", borderLeft: "1px solid var(--border-subtle)" }}>
            {items.map((c) => <ClassCard key={c.id} cls={c} onClick={() => onPick(c.id)} showRoom />)}
          </div>
        )
      })}
    </>
  )
}

/* ── Месяц: сетка дат ── */
function MonthGrid({ data, onPick }: { data: ScheduleData; onPick: (id: string) => void }) {
  const router = useRouter()
  const params = useSearchParams()

  const weeks = useMemo(() => {
    const anchor = new Date(data.date + "T00:00:00")
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d) }
    const w: Date[][] = []
    for (let i = 0; i < 6; i++) w.push(cells.slice(i * 7, i * 7 + 7))
    return w
  }, [data.date])

  const month = new Date(data.date + "T00:00:00").getMonth()
  const todayISO = toISODate(new Date())

  function openDay(d: Date) {
    const sp = new URLSearchParams(params.toString())
    sp.set("view", "day"); sp.set("date", toISODate(d))
    router.push(`/schedule?${sp.toString()}`)
  }

  return (
    <div>
      <div className="grid grid-cols-7">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((w) => (
          <div key={w} className="h-10 flex items-center justify-center text-xs font-medium" style={{ color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d) => {
          const iso = toISODate(d)
          const items = data.classes.filter((c) => c.date === iso && c.status !== "cancelled")
          const dim = d.getMonth() !== month
          return (
            <div key={iso} className="min-h-[104px] p-1.5 flex flex-col gap-1" style={{ borderBottom: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)", background: dim ? "var(--card-2)" : "var(--card)" }}>
              <button onClick={() => openDay(d)}
                className="self-start text-xs font-medium px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: iso === todayISO ? "#fff" : dim ? "var(--gray-muted)" : "var(--on-dark)", background: iso === todayISO ? "var(--orange)" : "transparent" }}>
                {d.getDate()}
              </button>
              {items.slice(0, 3).map((c) => {
                const col = fillColor(c.fill, c.status)
                return (
                  <button key={c.id} onClick={() => onPick(c.id)} className="text-left rounded px-1.5 py-0.5 text-[11px] font-medium truncate"
                    style={{ background: col.bg, color: col.text }}>
                    {c.startTime} {c.title}
                  </button>
                )
              })}
              {items.length > 3 && <span className="text-[11px] px-1" style={{ color: "var(--gray-muted)" }}>+{items.length - 3} ещё</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
