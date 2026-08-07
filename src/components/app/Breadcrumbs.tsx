"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { useAppLocale } from "./ClubContext"
import type { AppMessageKey } from "@/lib/app-locale"

const LABEL_KEYS: Record<string, AppMessageKey> = {
  dashboard: "nav.dashboard", inbox: "nav.inbox", leads: "nav.leads", clients: "nav.clients",
  memberships: "nav.memberships", visits: "nav.visits", schedule: "nav.schedule",
  payments: "nav.payments", staff: "nav.staff", settings: "nav.settings",
  club: "settings.basic", branches: "settings.branches", finance: "settings.finance",
  notifications: "settings.notifications", integrations: "nav.integrations",
  roles: "settings.roles", security: "settings.security", subscription: "settings.subscription",
  support: "nav.support", knowledge: "nav.knowledge", reports: "nav.reports",
  retention: "nav.retention", warehouse: "nav.warehouse", ai: "nav.ai",
}

const STATIC_LABELS: Record<string, string> = {
  profile: "Профиль",
  onboarding: "Онбординг",
  growth:        "Growth OS",
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function segmentLabel(seg: string, prev: string, t: (key: AppMessageKey) => string): string {
  if (LABEL_KEYS[seg]) return t(LABEL_KEYS[seg])
  if (STATIC_LABELS[seg]) return STATIC_LABELS[seg]
  if (isUUID(seg)) {
    if (prev === "clients")  return "Клиент"
    if (prev === "staff")    return "Профиль"
    return "Детали"
  }
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function Breadcrumbs() {
  const { t } = useAppLocale()
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => {
    const href  = "/" + segments.slice(0, i + 1).join("/")
    const label = segmentLabel(seg, segments[i - 1] ?? "", t)
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
