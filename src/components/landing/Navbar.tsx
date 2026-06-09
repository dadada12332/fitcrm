"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"

const navLinks = [
  { href: "#features", label: "Возможности" },
  { href: "#pricing", label: "Цены" },
  { href: "#faq", label: "FAQ" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState("#features")

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 w-full z-50 transition-all duration-300"
      style={{
        height: "64px",
        background: scrolled ? "rgba(255,255,255,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(12px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-bold text-xl tracking-tight flex-shrink-0"
          style={{ color: "var(--ink)", fontFamily: "var(--font-sans)" }}
        >
          FitCRM
        </Link>

        {/* Center pill nav */}
        <nav
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.25)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.4)",
          }}
        >
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setActive(href)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                fontFamily: "var(--font-sans)",
                background: active === href ? "rgba(255,255,255,0.85)" : "transparent",
                color: active === href ? "var(--ink)" : "var(--ink-soft)",
                boxShadow: active === href ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right CTA */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <Link
            href="/login"
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--ink)", fontFamily: "var(--font-sans)" }}
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold px-5 h-9 inline-flex items-center gap-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: "var(--cta-dark)",
              color: "#fff",
              fontFamily: "var(--font-sans)",
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--cta-dark-hover)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--cta-dark)")}
          >
            Попробовать →
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden p-2 rounded-full"
          style={{
            background: "rgba(255,255,255,0.3)",
            backdropFilter: "blur(8px)",
            color: "var(--ink)",
          }}
          onClick={() => setOpen(!open)}
          aria-label="Меню"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden absolute top-16 left-4 right-4 rounded-2xl px-6 py-5 flex flex-col gap-3"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 8px 32px rgba(14,101,173,0.12)",
          }}
        >
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium py-1"
              style={{ color: "var(--ink-soft)" }}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-black/5 flex flex-col gap-2">
            <Link href="/login" className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              Войти
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold px-5 h-10 inline-flex items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--cta-dark)", color: "#fff" }}
            >
              Попробовать бесплатно →
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
