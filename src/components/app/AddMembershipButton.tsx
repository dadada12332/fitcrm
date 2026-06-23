"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Clock, Trash2, ChevronDown } from "lucide-react"
import { createMembershipAction, type MembershipFormState } from "@/app/(app)/memberships/actions"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { DateField } from "@/components/ui/date-field"

const WEEKDAYS = [
  { key: "mon", label: "Понедельник", short: "Пн" },
  { key: "tue", label: "Вторник", short: "Вт" },
  { key: "wed", label: "Среда", short: "Ср" },
  { key: "thu", label: "Четверг", short: "Чт" },
  { key: "fri", label: "Пятница", short: "Пт" },
  { key: "sat", label: "Суббота", short: "Сб" },
  { key: "sun", label: "Воскресенье", short: "Вс" },
]

const inputCls = "h-11 w-full rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
const inputStyle = { background: "white", border: "1px solid #e2e8f0", color: "#020617" } as const

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
      {children}{required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  )
}

export function AddMembershipButton() {
  const [open, setOpen] = useState(false)
  const [freeze, setFreeze] = useState(true)
  const router = useRouter()
  const [state, formAction, pending] = useActionState<MembershipFormState, FormData>(createMembershipAction, {})

  useEffect(() => {
    if (state.ok) {
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "#0f172a", color: "#f8fafc" }}
      >
        <Plus className="w-4 h-4" />
        Добавить абонемент
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-[520px]">
          <form action={formAction} className="flex flex-col h-full">
            <SheetHeader>
              <SheetTitle>Добавление абонемента</SheetTitle>
              <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors" style={{ color: "#64748b" }}>
                <X className="w-4 h-4" />
              </SheetClose>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-4">
                <div>
                  <Label required>Название</Label>
                  <input name="name" required autoFocus placeholder="Введите название" className={inputCls} style={inputStyle} />
                </div>

                <div>
                  <Label>Описание</Label>
                  <textarea name="description" rows={3} placeholder="Краткое описание абонемента"
                    className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    style={inputStyle} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>Срок действия</Label>
                    <DateField name="valid_until" className={`${inputCls} pr-9`} style={inputStyle} />
                  </div>
                  <div>
                    <Label required>Количество посещений</Label>
                    <input name="visits_limit" placeholder="Например 12 или unlim" className={inputCls} style={inputStyle} />
                  </div>
                </div>

                {/* Подкарточка: дни + стоимость за день + заморозка */}
                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ border: "1px solid #e2e8f0" }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Количество дней</Label>
                      <input name="duration_days" type="number" min="1" defaultValue={30} placeholder="Например 12 или unlim" className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <Label required>Стоимость за 1 день</Label>
                      <input name="price_per_day" placeholder="Например 50 000 или free" className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Switch checked={freeze} onCheckedChange={setFreeze} />
                    <input type="hidden" name="freeze_allowed" value={freeze ? "on" : "off"} />
                    <span className="text-sm" style={{ color: "#334155" }}>Можно замораживать</span>
                  </label>
                </div>

                <div>
                  <Label required>Цена</Label>
                  <input name="price" type="number" min="0" required placeholder="Например 450 000" className={inputCls} style={inputStyle} />
                </div>

                <div>
                  <Label required>Доступные дни</Label>
                  <AvailableDays />
                </div>

                <div>
                  <Label required>Доступное время</Label>
                  <AvailableTime />
                </div>

                <div>
                  <Label required>Статус</Label>
                  <select name="status" defaultValue="active" className={inputCls} style={inputStyle}>
                    <option value="active">Активный</option>
                    <option value="archived">Архив</option>
                  </select>
                </div>

                {state.error && <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>}
              </div>
            </SheetBody>

            <SheetFooter>
              <button type="submit" disabled={pending}
                className="flex-1 h-11 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ background: "#0f172a" }}>
                {pending ? "Сохранение…" : "Сохранить"}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-md text-sm font-medium transition-colors hover:bg-slate-50" style={{ background: "white", border: "1px solid #e2e8f0", color: "#334155" }}>
                Добавить в черновик
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Инпут-триггер, по клику снизу выпадает панель с контентом. */
function PopoverField({ summary, children }: { summary: string; placeholder?: string; children: React.ReactNode }) {
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
        <span className="truncate" style={{ color: empty ? "#94a3b8" : "#020617" }}>{summary}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" style={{ color: "#94a3b8" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg p-3 shadow-lg"
          style={{ background: "white", border: "1px solid #e2e8f0" }}>
          {children}
        </div>
      )}
    </div>
  )
}

function AvailableDays() {
  const [sel, setSel] = useState<Set<string>>(() => new Set(["mon", "wed", "fri", "sun"]))
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
            <span className="text-sm" style={{ color: "#334155" }}>{d.label}</span>
          </label>
        ))}
      </div>
    </PopoverField>
  )
}

type Interval = { from: string; to: string }

function AvailableTime() {
  const [items, setItems] = useState<Interval[]>([{ from: "06:00", to: "12:00" }])

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
            <span className="text-sm" style={{ color: "#64748b" }}>с</span>
            <div className="relative flex-1">
              <Clock className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input type="time" value={it.from} onChange={(e) => update(i, { from: e.target.value })} className={timeCls} style={inputStyle} />
            </div>
            <span className="text-sm" style={{ color: "#64748b" }}>до</span>
            <div className="relative flex-1">
              <Clock className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input type="time" value={it.to} onChange={(e) => update(i, { to: e.target.value })} className={timeCls} style={inputStyle} />
            </div>
            <button type="button" onClick={() => remove(i)}
              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: "#dc2626" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={add}
          className="h-10 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-slate-50 self-start"
          style={{ background: "white", border: "1px solid #e2e8f0", color: "#334155" }}>
          <Plus className="w-4 h-4" />Добавить интервал
        </button>
      </div>
    </PopoverField>
  )
}
