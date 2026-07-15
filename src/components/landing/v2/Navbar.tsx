"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from "lucide-react"
import { useT } from "@/lib/i18n/context"
import { LangSwitcher } from "./LangSwitcher"

export function Navbar() {
  const t = useT()
  const [open, setOpen] = useState(false)

  const LINKS = [
    { href: "#features",   label: t.nav.features },
    { href: "#howitworks", label: t.nav.howitworks },
    { href: "#pricing",    label: t.nav.pricing },
  ]

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex flex-col items-center px-4 pt-4">
      <nav
        className="flex items-center justify-between w-full max-w-[1024px] px-3 py-[7px] rounded-full"
        style={{
          background: "rgba(255,255,255,0.5)",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 h-9 flex-shrink-0">
          <span className="w-7 h-7 rounded-md flex items-center justify-center bg-neutral-900">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </span>
          <span className="text-[14px] font-medium text-[#0a0a0a]">FitCRM</span>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center">
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href}
              className="px-4 py-2 text-[14px] font-medium text-[#0a0a0a]/60 hover:text-[#0a0a0a] transition-colors rounded-full">
              {label}
            </Link>
          ))}
        </div>

        {/* Right buttons */}
        <div className="hidden md:flex items-center gap-[9px]">
          <LangSwitcher />
          <Link href="/login"
            className="px-[17px] h-9 flex items-center text-[14px] font-medium text-[#0a0a0a] hover:text-[#0a0a0a]/70 transition-colors">
            {t.nav.login}
          </Link>
          <Link href="/register"
            className="h-[34px] flex items-center px-4 rounded-full text-[14px] font-medium text-[#eff6ff] hover:opacity-90 transition-opacity"
            style={{ background: "#0065fc" }}>
            {t.nav.start}
          </Link>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-2">
          <LangSwitcher compact />
          <button className="p-1 text-[#0a0a0a]" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="mt-2 w-full max-w-[1024px] rounded-[14px] border border-black/[0.07] p-4 flex flex-col gap-2 animate-lp-fadein shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
          style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)" }}>
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className="py-2 text-[14px] font-medium text-[#0a0a0a]/70 hover:text-[#0a0a0a] transition-colors">
              {label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2 border-t border-black/[0.07]">
            <Link href="/login"
              className="flex-1 text-center py-2 text-[14px] font-medium text-[#0a0a0a] border border-black/10 rounded-full">
              {t.nav.login}
            </Link>
            <Link href="/register"
              className="flex-1 text-center py-2 text-[14px] font-medium text-[#eff6ff] rounded-full"
              style={{ background: "#0065fc" }}>
              {t.nav.start}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
