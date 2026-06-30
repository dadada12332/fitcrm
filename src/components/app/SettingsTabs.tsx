"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2, GitFork, Users, Wallet,
  Bell, Plug, Shield, Crown, ShieldCheck,
} from "lucide-react"

const TABS = [
  { href: "/settings/club",          label: "Основное",       icon: Building2   },
  { href: "/settings/branches",      label: "Филиалы",        icon: GitFork     },
  { href: "/settings/staff",         label: "Сотрудники",     icon: Users       },
  { href: "/settings/finance",       label: "Финансы",        icon: Wallet      },
  { href: "/settings/notifications", label: "Уведомления",    icon: Bell        },
  { href: "/settings/integrations",  label: "Интеграции",     icon: Plug        },
  { href: "/settings/roles",         label: "Роли и права",   icon: ShieldCheck },
  { href: "/settings/security",      label: "Безопасность",   icon: Shield      },
  { href: "/settings/subscription",  label: "Подписка",       icon: Crown       },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <nav className="flex items-end overflow-x-auto" style={{ gap: 0, scrollbarWidth: "none" }}>
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 relative transition-colors flex-shrink-0"
              style={{
                height: 44,
                paddingLeft: 14,
                paddingRight: 14,
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? "#2563eb" : "var(--on-dark-soft)",
                whiteSpace: "nowrap",
                borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <Icon
                style={{
                  width: 15,
                  height: 15,
                  color: active ? "#2563eb" : "var(--gray-muted)",
                  flexShrink: 0,
                }}
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
