"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from "lucide-react"

const navLinks = [
  { href: "#features", label: "Возможности" },
  { href: "#pricing", label: "Цены" },
  { href: "#faq", label: "FAQ" },
  { href: "#download", label: "Скачать" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-4 inset-x-0 z-50 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="glass flex items-center justify-between rounded-full pl-5 pr-2 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center btn-neon"
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </span>
            <span
              className="text-lg tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}
            >
              FitCRM
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs font-medium uppercase tracking-wider transition-colors duration-150"
                style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right CTA */}
          <Link
            href="/register"
            className="btn-neon hidden md:inline-flex items-center h-10 px-5 rounded-full text-xs font-semibold uppercase tracking-wider text-white flex-shrink-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Начать
          </Link>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 mr-1 rounded-lg text-white"
            onClick={() => setOpen(!open)}
            aria-label="Меню"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="glass md:hidden mt-2 rounded-2xl px-6 py-5 flex flex-col gap-3">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium uppercase tracking-wider py-1"
                style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-display)" }}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <Link
                href="/register"
                className="btn-neon text-sm font-semibold uppercase tracking-wider px-5 h-10 inline-flex items-center justify-center rounded-full text-white w-full"
                style={{ fontFamily: "var(--font-display)" }}
                onClick={() => setOpen(false)}
              >
                Начать →
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
