import { IntegrationsPanel } from "@/components/app/IntegrationsPanel"
import { Plug } from "lucide-react"

export const metadata = { title: "Интеграции — FitCRM" }

export default function IntegrationsPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(37,99,235,0.1)" }}>
          <Plug className="w-5 h-5" style={{ color: "#2563eb" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
            Интеграции
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
            Подключите платёжные системы и мессенджеры к вашему клубу
          </p>
        </div>
      </div>

      <IntegrationsPanel />
    </div>
  )
}
