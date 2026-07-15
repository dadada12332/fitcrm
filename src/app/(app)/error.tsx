"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
        <AlertTriangle className="w-8 h-8" style={{ color: "#dc2626" }} />
      </div>

      <div className="text-center max-w-sm">
        <p className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>
          Не удалось загрузить страницу
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--on-dark-soft)" }}>
          Произошла ошибка на сервере. Попробуйте обновить страницу.
        </p>
        {error.digest && (
          <p className="text-xs mt-2 font-mono" style={{ color: "var(--gray-muted)" }}>
            {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium"
          style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}>
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
          style={{ background: "#0f172a" }}>
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>
    </div>
  )
}
