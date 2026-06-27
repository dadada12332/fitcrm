"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]

/** Маска dd.mm.yyyy: точки подставляются автоматически при наборе, удаляются при backspace. */
function maskDate(prev: string, next: string): string {
  const digits = next.replace(/\D/g, "").slice(0, 8)
  let out = ""
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += "."
    out += digits[i]
  }
  // trailing dot — только при наборе вперёд, когда группа завершена
  if (next.length >= prev.length && (digits.length === 2 || digits.length === 4)) {
    out += "."
  }
  return out
}

function parseDate(v: string): Date | null {
  const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getDate() !== d || dt.getMonth() !== mo || dt.getFullYear() !== y) return null
  return dt
}

function fmt(dt: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`
}

type Props = {
  name?: string
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  defaultValue?: string
}

export function DateField({ name, placeholder = "дд.мм.гггг", className, style, defaultValue = "" }: Props) {
  const [value, setValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState(() => parseDate(defaultValue) ?? new Date())
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const selected = parseDate(value)

  // строим сетку месяца (Пн первый)
  const year = view.getFullYear(), month = view.getMonth()
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = new Date()
  const isSameDay = (a: Date, d: number) => a.getFullYear() === year && a.getMonth() === month && a.getDate() === d

  function pick(d: number) {
    const dt = new Date(year, month, d)
    setValue(fmt(dt))
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(maskDate(value, e.target.value))}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          inputMode="numeric"
          className={className}
          style={style}
        />
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          style={{ color: "var(--gray-muted)" }} tabIndex={-1}>
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[280px] rounded-lg p-3 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {/* header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* weekdays */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="h-7 flex items-center justify-center text-xs" style={{ color: "var(--gray-muted)" }}>{w}</span>
            ))}
          </div>
          {/* days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />
              const isSel = selected ? isSameDay(selected, d) : false
              const isToday = isSameDay(today, d)
              return (
                <button key={i} type="button" onClick={() => pick(d)}
                  className="h-8 flex items-center justify-center rounded-md text-sm transition-colors"
                  style={isSel
                    ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                    : { color: "var(--on-dark)", border: isToday ? "1px solid var(--border)" : "1px solid transparent" }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--card-2)" }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent" }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
