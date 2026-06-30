"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import type { SidebarStats } from "@/lib/sidebar"
import type { RolePermissions } from "@/lib/permissions"

type Props = {
  clubId: string
  clubName: string
  plan: string
  email: string
  stats: SidebarStats
  permissions: RolePermissions
  role: string
  children: React.ReactNode
}

export function AppShell({ clubId, clubName, plan, email, stats, permissions, role, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  const handleMenuToggle = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen((v) => !v)
    } else {
      setCollapsed((v) => !v)
    }
  }

  const sidebarProps = { clubId, clubName, plan, stats, permissions, role }

  return (
    <div className="flex h-screen overflow-hidden gap-2 bg-white dark:bg-zinc-950">

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            style={{ backdropFilter: "blur(2px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 p-2 transition-transform"
            style={{ width: 300 }}
          >
            <Sidebar {...sidebarProps} collapsed={false} />
          </div>
        </div>
      )}

      <div
        className="hidden lg:flex flex-shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 72 : 300, padding: "8px 0 8px 8px" }}
      >
        <Sidebar {...sidebarProps} collapsed={collapsed} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          email={email}
          clubName={clubName}
          onToggleSidebar={handleMenuToggle}
        />
        <div className="flex-1 overflow-hidden p-2 lg:pl-0 lg:pt-0">
          <main className="h-full overflow-y-auto rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 lg:p-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
