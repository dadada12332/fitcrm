"use client"

import { AppNavbar } from "./AppNavbar"

type Props = {
  clubName: string
  email: string
  children: React.ReactNode
}

export function AppShell({ clubName, email, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      <AppNavbar clubName={clubName} email={email} />
      <main className="pt-[60px] p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
