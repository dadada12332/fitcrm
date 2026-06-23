"use client"

import { X } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"

export type FilterSection = "status" | "type" | "days"

const STATUS_OPTIONS = [
  { key: "active", label: "Активные" },
  { key: "expiring", label: "Заканчиваются скоро" },
  { key: "expired", label: "Истекшие" },
  { key: "frozen", label: "Замороженные" },
]

const DAYS_OPTIONS = [
  { key: "0-3", label: "0–3 дня" },
  { key: "4-7", label: "4–7 дней" },
  { key: "8-14", label: "8–14 дней" },
  { key: "14+", label: "Более 14 дней" },
]

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  status: Set<string>
  type: Set<string>
  days: Set<string>
  typeOptions: string[]
  onToggle: (section: FilterSection, value: string) => void
  onClear: () => void
}

function Section({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: { key: string; label: string }[]
  selected: Set<string>
  onToggle: (key: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>{title}</p>
      <div className="flex flex-col">
        {options.map((o) => (
          <label key={o.key} className="flex items-center gap-3 py-2.5 cursor-pointer">
            <Checkbox checked={selected.has(o.key)} onCheckedChange={() => onToggle(o.key)} />
            <span className="text-sm" style={{ color: "#334155" }}>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function ClientsFilterDrawer({
  open,
  onOpenChange,
  status,
  type,
  days,
  typeOptions,
  onToggle,
  onClear,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Фильтр</SheetTitle>
          <SheetClose
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
            style={{ color: "#64748b" }}
          >
            <X className="w-4 h-4" />
          </SheetClose>
        </SheetHeader>

        <SheetBody>
          <Section title="Статус абонемента" options={STATUS_OPTIONS} selected={status} onToggle={(k) => onToggle("status", k)} />
          <div style={{ borderTop: "1px solid #e2e8f0" }} className="mb-6" />
          <Section
            title="Тип абонемента"
            options={typeOptions.map((t) => ({ key: t, label: t }))}
            selected={type}
            onToggle={(k) => onToggle("type", k)}
          />
          <div style={{ borderTop: "1px solid #e2e8f0" }} className="mb-6" />
          <Section title="Остаток дней" options={DAYS_OPTIONS} selected={days} onToggle={(k) => onToggle("days", k)} />
        </SheetBody>

        <SheetFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-11 px-6 rounded-md text-sm font-medium text-white"
            style={{ background: "#0f172a" }}
          >
            Применить
          </button>
          <button onClick={onClear} className="h-11 px-4 rounded-md text-sm font-medium" style={{ color: "#64748b" }}>
            Очистить
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
