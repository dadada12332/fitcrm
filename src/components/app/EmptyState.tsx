import type { ReactNode } from "react"

/**
 * Единое пустое состояние для списков CRM. Раньше разделы были непоследовательны:
 * clients/memberships показывали иконку + подсказку + CTA, а payments/visits —
 * просто «Платежей нет». Теперь везде одинаково: иконка, заголовок, пояснение, действие.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "var(--card-2, #f1f5f9)", border: "1px solid var(--border)" }}
      >
        {icon}
      </div>
      <p className="text-base font-semibold mb-1.5" style={{ color: "var(--on-dark)" }}>{title}</p>
      {subtitle && <p className="text-sm max-w-sm leading-relaxed" style={{ color: "var(--gray-muted)" }}>{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
