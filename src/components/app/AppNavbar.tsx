"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Menu,
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  Wallet,
  Search,
  Bell,
  Zap,
  LogOut,
} from "lucide-react"
import { useState } from "react"
import { signOut } from "@/app/(auth)/actions"

const nav = [
  { href: "/dashboard",   label: "Дашборд",    icon: LayoutDashboard },
  { href: "/clients",     label: "Клиенты",    icon: Users },
  { href: "/memberships", label: "Абонементы", icon: CreditCard },
  { href: "/schedule",    label: "Расписание", icon: Calendar },
  { href: "/payments",    label: "Оплата",     icon: Wallet },
]

type Props = {
  clubName: string
  email: string
}

export function AppNavbar({ clubName, email }: Props) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = email.charAt(0).toUpperCase()

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-[60px] flex items-center px-4"
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between w-full gap-4">

        {/* ── Left: burger + logo ── */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-secondary"
            style={{ border: "1px solid var(--border)" }}
            aria-label="Меню"
          >
            <Menu className="w-4 h-4 text-foreground" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--orange)" }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </span>
            <span
              className="text-sm hidden sm:block"
              style={{
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: "var(--on-dark)",
              }}
            >
              FitCRM
            </span>
          </Link>
        </div>

        {/* ── Center: tab group ── */}
        <nav
          className="hidden md:flex items-center gap-0.5 p-1 rounded-md"
          style={{ background: "#f1f5f9" }}
        >
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
                style={{
                  background: active ? "white" : "transparent",
                  color: active ? "var(--on-dark)" : "#64748b",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "-0.004em",
                }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Right: search, bell, avatar ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Поиск"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Уведомления"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Avatar + dropdown */}
          <div className="relative ml-1">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-80"
              style={{ background: "var(--orange)" }}
              title={email}
            >
              {initials}
            </button>

            {profileOpen && (
              <>
                {/* backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileOpen(false)}
                />
                <div
                  className="absolute right-0 top-11 z-20 w-52 rounded-xl py-2 text-sm"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                  }}
                >
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="font-medium text-foreground truncate">{clubName}</p>
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                  </div>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
