"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  Wallet,
  CheckSquare,
  Search,
  Bell,
  Zap,
  LogOut,
  ChevronDown,
  Check,
  Plus,
  Building2,
} from "lucide-react"
import { useState } from "react"
import { signOut } from "@/app/(auth)/actions"

const nav = [
  { href: "/dashboard",   label: "Дашборд",    icon: LayoutDashboard },
  { href: "/clients",     label: "Клиенты",    icon: Users },
  { href: "/memberships", label: "Абонементы", icon: CreditCard },
  { href: "/schedule",    label: "Расписание", icon: Calendar },
  { href: "/visits",      label: "Посещения",  icon: CheckSquare },
  { href: "/payments",    label: "Оплата",     icon: Wallet },
]

type Props = {
  clubName: string
  email: string
}

export function AppNavbar({ clubName, email }: Props) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)

  const initials = email.charAt(0).toUpperCase()

  // Placeholder branches list — current club is always first
  const branches = [clubName]

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-[60px] flex items-center px-4"
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="relative flex items-center w-full">

        {/* ── Left: logo ── */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="flex items-center gap-2">
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

            {/* ── Branch switcher ── */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => { setBranchOpen((v) => !v); setProfileOpen(false) }}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium transition-colors hover:bg-secondary"
                style={{ color: "#64748b", border: "1px solid var(--border)" }}
              >
                <Building2 className="w-3 h-3" />
                <span className="max-w-[100px] truncate">{clubName}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>

              {branchOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBranchOpen(false)} />
                  <div
                    className="absolute left-0 top-8 z-20 w-52 rounded-xl py-1.5 text-sm"
                    style={{ background: "white", border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                  >
                    <div className="px-2.5 py-1.5 mb-1">
                      <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>Филиалы</p>
                    </div>

                    {branches.map((b) => (
                      <button
                        key={b}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg mx-1 transition-colors hover:bg-slate-50"
                        style={{ width: "calc(100% - 8px)", color: "#020617" }}
                      >
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--orange)" }} />
                        <span className="truncate">{b}</span>
                      </button>
                    ))}

                    <div className="h-px mx-3 my-1.5" style={{ background: "#e5e7eb" }} />

                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                      style={{ color: "#64748b" }}
                      onClick={() => setBranchOpen(false)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить филиал
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: tab group — абсолютно по центру ── */}
        <nav
          className="hidden md:flex items-center gap-0.5 p-1 rounded-md absolute left-1/2 -translate-x-1/2"
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
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
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
