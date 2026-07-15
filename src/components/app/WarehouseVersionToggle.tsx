"use client"

import { List, LayoutGrid } from "lucide-react"

export type WarehouseVersion = "table" | "pos"

/** Переключатель режима склада: Таблица (учёт) / Витрина (POS-продажи). */
export function WarehouseVersionToggle({ value, onChange }: {
  value: WarehouseVersion
  onChange: (v: WarehouseVersion) => void
}) {
  const items: { key: WarehouseVersion; label: string; icon: typeof List }[] = [
    { key: "table", label: "Таблица", icon: List },
    { key: "pos", label: "Витрина", icon: LayoutGrid },
  ]
  return (
    <div className="inline-flex items-center h-9 p-0.5 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {items.map(({ key, label, icon: Icon }) => {
        const active = value === key
        return (
          <button key={key} onClick={() => onChange(key)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-all"
            style={{ background: active ? "#2563eb" : "transparent", color: active ? "white" : "var(--on-dark-soft)" }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        )
      })}
    </div>
  )
}
