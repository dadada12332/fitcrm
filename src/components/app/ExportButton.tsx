import { Download } from "lucide-react"

export function ExportButton() {
  return (
    <a
      href="/dashboard/export"
      className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors"
      style={{ background: "white", color: "#020617", border: "1px solid #e2e8f0" }}
    >
      <Download className="w-4 h-4" />
      Экспорт в excel
    </a>
  )
}
