"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download, Loader2 } from "lucide-react"
import { exportClientsCsvAction } from "@/app/(app)/clients/actions"

export function ExportClientsButton() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      // Экспортируем ВСЕХ клиентов с учётом текущих фильтров (не только страницу).
      const res = await exportClientsCsvAction({
        search: searchParams.get("q") ?? "",
        status: searchParams.getAll("status"),
        membership: searchParams.getAll("membership"),
        days: searchParams.getAll("days"),
        sort: searchParams.get("sort") ?? undefined,
      })
      if (res.error || !res.csv) return
      const blob = new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60"
      style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Экспорт клиентов
    </button>
  )
}
