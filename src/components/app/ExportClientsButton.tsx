"use client"

import { Download } from "lucide-react"
import type { ClientRow } from "@/lib/clients"

function toCSV(rows: ClientRow[]): string {
  const header = ["Имя", "Телефон", "Дата рожд.", "Пол", "Абонемент", "Источник", "Статус"]
  const lines = rows.map((r) => [
    r.name,
    r.phone ?? "",
    r.birthDate ?? "",
    r.gender === "male" ? "Мужской" : r.gender === "female" ? "Женский" : "",
    r.membership ?? "",
    r.source ?? "",
    r.status === "active" ? "Активный" : r.status === "frozen" ? "Заморожен" : "Истёк",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
  return [header.join(","), ...lines].join("\r\n")
}

export function ExportClientsButton({ rows }: { rows: ClientRow[] }) {
  function handleExport() {
    const csv = toCSV(rows)
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
    >
      <Download className="w-4 h-4" />
      Экспорт клиентов
    </button>
  )
}
