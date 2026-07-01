"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from "lucide-react"

const links = [
  { href: "#features", label: "Возможности" },
  { href: "#product", label: "Продукт" },
  { href: "#pricing", label: "Цены" },
  { href: "#faq", label: "FAQ" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-4 inset-x-0 z-50 px-4">
      <div className="v3-chip max-w-5xl mx-auto rounded-full flex items-center justify-between pl-5 pr-2 h-14 backdrop-blur-xl">
        <Link href="/v3" className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center v3-btn">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">FitCRM</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors px-3">Войти</Link>
          <Link href="/register" className="v3-btn inline-flex items-center h-10 px-5 rounded-full text-sm font-medium">Начать</Link>
        </div>
        <button className="md:hidden p-2 mr-1 rounded-lg text-white" onClick={() => setOpen(!open)} aria-label="Меню">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="v3-chip md:hidden mt-2 max-w-5xl mx-auto rounded-2xl px-5 py-4 flex flex-col gap-3 backdrop-blur-xl">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-white/70 py-1" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <Link href="/register" className="v3-btn inline-flex items-center justify-center h-10 rounded-full text-sm font-medium" onClick={() => setOpen(false)}>Начать</Link>
        </div>
      )}
    </header>
  )
}
