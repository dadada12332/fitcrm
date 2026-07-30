"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard, Building2, Users, CreditCard, Receipt, BarChart3,
  Activity, ScrollText, LifeBuoy, Send, Ticket, Settings,
  LogOut, Menu, ExternalLink, Tag, Plug, X, SunMoon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand/BrandLogo"

export type NavItem = { label: string; href: string; icon: string; badge?: number; badgeLabel?: string; section?: string }

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
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const home = base || "/"

  useEffect(() => {
    if (!mobileOpen) return
    const drawer = drawerRef.current
    if (!drawer) return
    const menuTrigger = menuTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusable = () => Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    ;(focusable()[0] ?? drawer).focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const items = focusable()
      if (!items.length) {
        event.preventDefault()
        drawer.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      menuTrigger?.focus()
    }
  }, [mobileOpen])

  const isActive = (href: string) => {
    if (href === home) return pathname === home
    return pathname === href || pathname.startsWith(href + "/")
  }

  const renderSidebar = (mobile = false) => (
    <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <BrandMark appIcon className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">Zalkins Platform</p>
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
                ) : item.badgeLabel ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.badgeLabel}
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
      <div className="hidden w-[260px] shrink-0 lg:block">{renderSidebar()}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация платформы"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[min(300px,86vw)] shadow-2xl outline-none"
          >
            {renderSidebar(true)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Button ref={menuTriggerRef} type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Открыть меню платформы">
            <Menu className="size-5" />
          </Button>
          <BrandMark appIcon className="size-7" />
          <span className="text-sm font-semibold">Zalkins Platform</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
