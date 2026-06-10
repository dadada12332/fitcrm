"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap, LayoutDashboard, Users, CreditCard, Calendar, Wallet } from "lucide-react"

const nav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/memberships", label: "Абонементы", icon: CreditCard },
  { href: "/schedule", label: "Расписание", icon: Calendar },
  { href: "/payments", label: "Оплаты", icon: Wallet },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col w-60 flex-shrink-0 p-4"
      style={{ background: "var(--card)", borderRight: "1px solid var(--border)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3 mb-4">
        <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--orange)" }}>
          <Zap className="w-4 h-4 text-white" fill="white" />
        </span>
        <span className="text-lg text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
          FitCRM
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? "rgba(37,99,235,0.15)" : "transparent",
                color: active ? "var(--orange)" : "var(--on-dark-soft)",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
