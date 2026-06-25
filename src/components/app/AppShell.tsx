"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import type { SidebarStats } from "@/lib/sidebar"

type Props = {
  clubId: string
  clubName: string
  plan: string
  email: string
  stats: SidebarStats
  children: React.ReactNode
}

export function AppShell({ clubId, clubName, plan, email, stats, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <div
        className="flex-shrink-0 p-2 transition-all duration-200"
        style={{ width: collapsed ? 72 : 272 }}
      >
        <Sidebar
          clubId={clubId}
          clubName={clubName}
          plan={plan}
          stats={stats}
          collapsed={collapsed}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          email={email}
          clubName={clubName}
          onToggleSidebar={() => setCollapsed((v) => !v)}
        />
        <div className="flex-1 overflow-hidden" style={{ padding: "0 8px 8px 0" }}>
          <main className="h-full overflow-y-auto rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="p-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
