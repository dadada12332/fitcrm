"use client"

import Link from "next/link"
import { Search, Bell, Zap, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useState } from "react"
import { signOut } from "@/app/(auth)/actions"

type Props = {
  clubName: string
  email: string
  onToggle: () => void
  onMobileOpen: () => void
}

export function AppHeader({ clubName, email, onToggle, onMobileOpen }: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = email.charAt(0).toUpperCase()

  return (
    <header
      className="h-[60px] flex items-center justify-between px-4 flex-shrink-0 z-30"
      style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Left: toggle + logo */}
      <div className="flex items-center gap-3 w-[228px] flex-shrink-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100"
          style={{ color: "var(--on-dark-soft)" }}
          aria-label="Открыть меню"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-9 h-9 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 flex-shrink-0"
          style={{ color: "var(--on-dark-soft)" }}
          aria-label="Свернуть/развернуть сайдбар"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "#0c111d",
              boxShadow: "0 2px 3px -1px rgba(42,42,42,0.14), 0 1px 1px rgba(42,42,42,0.08)",
              border: "1.33px solid rgba(255,255,255,0.12)",
            }}
          >
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <div className="hidden sm:flex flex-col min-w-0">
            <span className="text-sm font-medium leading-none tracking-[-0.084px] truncate" style={{ color: "#09090b" }}>
              fitCRM
            </span>
            <span className="text-xs leading-none mt-0.5 tracking-[-0.072px] truncate" style={{ color: "var(--on-dark-soft)" }}>
              {clubName}
            </span>
          </div>
        </Link>
      </div>

      {/* Right: search + bell + avatar */}
      <div className="flex items-center gap-1">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100"
          style={{ color: "var(--on-dark-soft)" }}
          aria-label="Поиск"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100"
          style={{ color: "var(--on-dark-soft)" }}
          aria-label="Уведомления"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="relative ml-1">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: "#0c111d" }}
            title={email}
          >
            {initials}
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div
                className="absolute right-0 top-11 z-20 w-52 rounded-xl py-2 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
              >
                <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                  <p className="font-medium text-zinc-900 truncate">{email.split("@")[0]}</p>
                  <p className="text-xs text-zinc-500 truncate">{email}</p>
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
    </header>
  )
}
