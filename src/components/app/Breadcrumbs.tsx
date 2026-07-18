"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

const LABELS: Record<string, string> = {
  dashboard:     "Дашборд",
  clients:       "Клиенты",
  memberships:   "Абонементы",
  visits:        "Посещения",
  schedule:      "Расписание",
  payments:      "Оплата",
  staff:         "Сотрудники",
  profile:       "Профиль",
  settings:      "Настройки",
  club:          "Основное",
  branches:      "Филиалы",
  finance:       "Финансы",
  notifications: "Уведомления",
  integrations:  "Интеграции",
  roles:         "Роли и права",
  security:      "Безопасность",
  subscription:  "Подписка",
  onboarding:    "Онбординг",
  support:       "Поддержка",
  knowledge:     "База знаний",
  reports:       "Отчёты",
  retention:     "Удержание",
  warehouse:     "Склад",
  ai:            "AI Аналитика",
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function segmentLabel(seg: string, prev: string): string {
  if (LABELS[seg]) return LABELS[seg]
  if (isUUID(seg)) {
    if (prev === "clients")  return "Клиент"
    if (prev === "staff")    return "Профиль"
    return "Детали"
  }
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => {
    const href  = "/" + segments.slice(0, i + 1).join("/")
    const label = segmentLabel(seg, segments[i - 1] ?? "")
    return { href, label }
  })

  return (
    <nav className="flex items-center min-w-0" style={{ gap: 6 }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.href} className="flex items-center min-w-0" style={{ gap: 6 }}>
            {i > 0 && (
              <ChevronRight
                className="flex-shrink-0"
                style={{ width: 16, height: 16, color: "var(--gray-muted)" }}
              />
            )}
            {isLast ? (
              <span
                className="whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontSize: 14, color: "var(--on-dark)", fontWeight: 400 }}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="whitespace-nowrap overflow-hidden text-ellipsis transition-colors hover:text-[var(--on-dark)]"
                style={{ fontSize: 14, color: "var(--on-dark-soft)" }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
