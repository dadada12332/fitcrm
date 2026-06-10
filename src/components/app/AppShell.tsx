"use client"

import { useState, useEffect } from "react"
import { AppHeader } from "./AppHeader"
import { AppSidebar } from "./AppSidebar"

type Props = {
  clubName: string
  email: string
  children: React.ReactNode
}

export function AppShell({ clubName, email, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed")
      if (saved === "true") setCollapsed(true)
    } catch {}
  }, [])

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v
      try { localStorage.setItem("sidebar-collapsed", String(next)) } catch {}
      return next
    })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#f8fafc" }}>
      <AppHeader
        clubName={clubName}
        email={email}
        onToggle={toggleCollapse}
        onMobileOpen={() => setMobileOpen(true)}
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* Desktop sidebar */}
        <div className="hidden md:block flex-shrink-0">
          <AppSidebar email={email} collapsed={collapsed} />
        </div>

        {/* Mobile backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-200 ${
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileOpen(false)}
        />

        {/* Mobile drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AppSidebar
            email={email}
            collapsed={false}
            mobile
            onClose={() => setMobileOpen(false)}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
