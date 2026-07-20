"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard, Building2, Users, CreditCard, Receipt, BarChart3,
  Activity, ScrollText, LifeBuoy, Send, Ticket, Settings, ShieldCheck,
  LogOut, Menu, ExternalLink, Tag, Plug, X, SunMoon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type NavItem = { label: string; href: string; icon: string; badge?: number; section?: string }

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
  const { resolvedTheme, setTheme } = useTheme()
  const home = base || "/"

  const isActive = (href: string) => {
    if (href === home) return pathname === home
    return pathname === href || pathname.startsWith(href + "/")
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <ShieldCheck className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">FitCRM Platform</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">Управление SaaS</p>
        </div>
        {mobile && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2.5 py-3">
        {nav.map((item, index) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard
          const active = isActive(item.href)
          const showSection = item.section && item.section !== nav[index - 1]?.section
          return (
            <div key={item.href}>
              {showSection && (
                <p className={`${index > 0 ? "mt-4" : ""} mb-1 px-2.5 text-[11px] font-medium uppercase text-muted-foreground`}>
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors ${active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"}`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        <a
          href={appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="flex-1 truncate">Открыть CRM</span>
        </a>
        <div className="mt-1 flex items-center gap-2.5 rounded-md bg-sidebar-accent/60 px-2.5 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{email}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {role === "super_admin" ? "Суперадминистратор" : "Администратор платформы"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Переключить тему"
          >
            <SunMoon className="size-3.5" />
          </Button>
          <form action={`${base}/logout`} method="post" className="contents">
            <Button type="submit" variant="ghost" size="icon-xs" aria-label="Выйти из платформы">
              <LogOut className="size-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <div className="hidden w-[260px] shrink-0 lg:block"><Sidebar /></div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />
          <div className="absolute inset-y-0 left-0 w-[min(300px,86vw)] shadow-2xl"><Sidebar mobile /></div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Открыть меню платформы">
            <Menu className="size-5" />
          </Button>
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-3.5" />
          </div>
          <span className="text-sm font-semibold">FitCRM Platform</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
