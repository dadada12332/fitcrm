import Link from "next/link"
import { SearchX } from "lucide-react"

export default function IntegrationNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <SearchX className="w-8 h-8" style={{ color: "#6366f1" }} />
      </div>
      <div className="text-center max-w-sm">
        <p className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>
          Интеграция не найдена
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--on-dark-soft)" }}>
          Такая интеграция не существует.
        </p>
      </div>
      <Link href="/integrations"
        className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center"
        style={{ background: "#0f172a" }}>
        К интеграциям
      </Link>
    </div>
  )
}
