"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Clock, Trash2, ChevronDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

export const inputCls = "h-11 w-full rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
export const inputStyle = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" } as const

const WEEKDAYS = [
  { key: "mon", label: "Понедельник", short: "Пн" },
  { key: "tue", label: "Вторник", short: "Вт" },
  { key: "wed", label: "Среда", short: "Ср" },
  { key: "thu", label: "Четверг", short: "Чт" },
  { key: "fri", label: "Пятница", short: "Пт" },
  { key: "sat", label: "Суббота", short: "Сб" },
  { key: "sun", label: "Воскресенье", short: "Вс" },
]

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
      {children}{required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  )
}

/** Количество дней: дропдаун Месяц/Год/Своё число (+ инпут для своего числа). */
export function DurationField({ initialDays = 30 }: { initialDays?: number }) {
  const initialMode = initialDays === 30 ? "month" : initialDays === 365 ? "year" : "custom"
  const [mode, setMode] = useState<"month" | "year" | "custom">(initialMode)
  const [custom, setCustom] = useState(String(initialDays))
  const days = mode === "month" ? "30" : mode === "year" ? "365" : custom

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="duration_days" value={days || "0"} />
      <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputCls} style={inputStyle}>
        <option value="month">Месяц (30 дней)</option>
        <option value="year">Год (365 дней)</option>
        <option value="custom">Своё число</option>
      </select>
      {mode === "custom" && (
        <input
          type="number" min="1" value={custom} autoFocus
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Введите количество дней"
          className={inputCls} style={inputStyle}
        />
      )}
    </div>
  )
}

/** Инпут-триггер, по клику снизу выпадает панель с контентом. */
function PopoverField({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const empty = summary === "Не выбрано"
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`} style={inputStyle}>
        <span className="truncate" style={{ color: empty ? "var(--gray-muted)" : "var(--on-dark)" }}>{summary}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" style={{ color: "var(--gray-muted)" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg p-3 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function AvailableDays({ initial }: { initial?: string[] }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(initial ?? ["mon", "wed", "fri", "sun"]))
  function toggle(key: string) {
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const chosen = WEEKDAYS.filter((d) => sel.has(d.key))
  const summary = chosen.length === 0
    ? "Не выбрано"
    : chosen.length === 7 ? "Все дни" : chosen.map((d) => d.short).join(", ")

  return (
    <PopoverField summary={summary}>
      <input type="hidden" name="available_days" value={chosen.map((d) => d.key).join(",")} />
      <div className="flex flex-col">
        {WEEKDAYS.map((d) => (
          <label key={d.key} className="flex items-center gap-3 py-2 cursor-pointer">
            <Checkbox checked={sel.has(d.key)} onCheckedChange={() => toggle(d.key)} />
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{d.label}</span>
          </label>
        ))}
      </div>
    </PopoverField>
  )
}

type Interval = { from: string; to: string }

function parseIntervals(initial?: string[]): Interval[] {
  if (!initial || initial.length === 0) return [{ from: "06:00", to: "12:00" }]
  return initial.map((s) => {
    const [from, to] = s.split("-")
    return { from: from ?? "06:00", to: to ?? "12:00" }
  })
}

export function AvailableTime({ initial }: { initial?: string[] }) {
  const [items, setItems] = useState<Interval[]>(() => parseIntervals(initial))

  function update(i: number, patch: Partial<Interval>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }
  function add() {
    setItems((prev) => [...prev, { from: "06:00", to: "12:00" }])
  }

  const timeCls = "h-10 w-full rounded-md pl-9 pr-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
  const summary = items.length === 0 ? "Не выбрано" : items.map((it) => `${it.from}–${it.to}`).join(", ")

  return (
    <PopoverField summary={summary}>
      <input type="hidden" name="available_time" value={items.map((it) => `${it.from}-${it.to}`).join(",")} />
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>с</span>
            <div className="relative flex-1">
              <Clock className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
              <input type="time" value={it.from} onChange={(e) => update(i, { from: e.target.value })} className={timeCls} style={inputStyle} />
            </div>
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>до</span>
            <div className="relative flex-1">
              <Clock className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
              <input type="time" value={it.to} onChange={(e) => update(i, { to: e.target.value })} className={timeCls} style={inputStyle} />
            </div>
            <button type="button" onClick={() => remove(i)}
              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: "#dc2626" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={add}
          className="h-10 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 self-start"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
          <Plus className="w-4 h-4" />Добавить интервал
        </button>
      </div>
    </PopoverField>
  )
}
