import { Download } from "lucide-react"

export function ExportButton() {
  return (
    <a
      href="/dashboard/export"
      className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors"
      style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
    >
      <Download className="w-4 h-4" />
      Экспорт в excel
    </a>
  )
}
