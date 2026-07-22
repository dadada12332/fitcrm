"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { downloadBlob } from "@/lib/csv"
import { showActionError } from "@/lib/plan-limit-client"
import { toast } from "sonner"

export function DashboardExportButton() {
  const [pending, setPending] = useState(false)

  async function download() {
    setPending(true)
    try {
      const response = await fetch("/dashboard/export")
      if (!response.ok) {
        showActionError(await response.text())
        return
      }
      downloadBlob(`fitcrm-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`, await response.blob())
      toast.success("Сводка XLSX готова")
    } catch {
      toast.error("Не удалось скачать сводку")
    } finally {
      setPending(false)
    }
  }

  return (
    <button type="button" onClick={download} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      <span className="hidden sm:inline">Скачать XLSX</span>
    </button>
  )
}
