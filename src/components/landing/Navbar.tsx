"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from "lucide-react"

const navLinks = [
  { href: "#features", label: "Возможности" },
  { href: "#capabilities", label: "Функции" },
  { href: "#usecases", label: "Применение" },
  { href: "#pricing", label: "Цены" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-4 inset-x-0 z-50 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="nav-pill flex items-center justify-between rounded-full pl-5 pr-2 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-strong)" }}>
              <Zap className="w-4 h-4 text-white" fill="white" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">FitCRM</span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors px-3">
              Войти
            </Link>
            <Link
              href="/register"
              className="btn-primary inline-flex items-center h-10 px-5 rounded-full text-sm font-medium"
            >
              Начать
            </Link>
          </div>

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
          <div className="nav-pill md:hidden mt-2 rounded-2xl px-6 py-5 flex flex-col gap-3">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-white/70 py-1"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <Link href="/login" className="text-sm text-white/70 py-1" onClick={() => setOpen(false)}>
                Войти
              </Link>
              <Link
                href="/register"
                className="btn-primary text-sm font-medium px-5 h-10 inline-flex items-center justify-center rounded-full w-full"
                onClick={() => setOpen(false)}
              >
                Начать
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
