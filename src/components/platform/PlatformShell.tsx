"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Building2, Users, CreditCard, Receipt, BarChart3,
  Activity, ScrollText, LifeBuoy, Send, Ticket, Settings, ShieldCheck,
  LogOut, Menu, ExternalLink, Tag, Plug,
} from "lucide-react"

export type NavItem = { label: string; href: string; icon: string; badge?: number }

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Building2, Users, CreditCard, Receipt, BarChart3,
  Activity, ScrollText, LifeBuoy, Send, Ticket, Settings, Tag, Plug,
}

export function PlatformShell({
  base, nav, email, role, appUrl, children,
}: {
  base: string
  nav: NavItem[]
  email: string
  role: string
  appUrl: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const home = base || "/"

  const isActive = (href: string) => {
    if (href === home) return pathname === home
    return pathname === href || pathname.startsWith(href + "/")
  }

  const SidebarInner = (
    <div className="flex flex-col h-full" style={{ background: "#0b1120", borderRight: "1px solid #1e293b" }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-16 shrink-0" style={{ borderBottom: "1px solid #1e293b" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)" }}>
          <ShieldCheck className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">FitCRM Platform</p>
          <p className="text-[11px] leading-tight truncate" style={{ color: "#475569" }}>Control Center</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: active ? "rgba(99,102,241,0.14)" : "transparent",
                color: active ? "#a5b4fc" : "#94a3b8",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="text-[11px] font-semibold px-1.5 h-5 min-w-5 flex items-center justify-center rounded-full" style={{ background: "#ef4444", color: "white" }}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 shrink-0" style={{ borderTop: "1px solid #1e293b" }}>
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
          style={{ color: "#64748b" }}
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">CRM клуба</span>
        </a>
        <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg" style={{ background: "#0f172a" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: "#4338ca" }}>
            {email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{email}</p>
            <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: role === "super_admin" ? "#a5b4fc" : "#64748b" }}>
              {role === "super_admin" ? "Super Admin" : "Platform Admin"}
            </p>
          </div>
          <form action={`${base}/logout`} method="post" className="contents">
            <button type="submit" className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" title="Выйти">
              <LogOut className="w-4 h-4" style={{ color: "#64748b" }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0f1c", fontFamily: "var(--font-sans)" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[248px] shrink-0">{SidebarInner}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[248px]">{SidebarInner}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 shrink-0" style={{ background: "#0b1120", borderBottom: "1px solid #1e293b" }}>
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: "#94a3b8" }}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white">FitCRM Platform</span>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
