"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, Zap } from "lucide-react"

const links = [
  { href: "#work", label: "Экраны" },
  { href: "#features", label: "Возможности" },
  { href: "#pricing", label: "Цены" },
  { href: "#faq", label: "FAQ" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-3 inset-x-0 z-50 px-4">
      <div className="v2-navbar max-w-6xl mx-auto rounded-2xl flex items-center justify-between pl-4 pr-2 h-14">
        <Link href="/v2" className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">FitCRM</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-3">Войти</Link>
          <Link href="/register" className="v2-btn-primary inline-flex items-center h-10 px-5 rounded-xl text-sm font-medium">
            Начать
          </Link>
        </div>

        <button className="md:hidden p-2 mr-1 rounded-lg text-zinc-900" onClick={() => setOpen(!open)} aria-label="Меню">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="v2-navbar md:hidden mt-2 max-w-6xl mx-auto rounded-2xl px-5 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-zinc-700 py-1" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <Link href="/register" className="v2-btn-primary inline-flex items-center justify-center h-10 rounded-xl text-sm font-medium" onClick={() => setOpen(false)}>
            Начать
          </Link>
        </div>
      )}
    </header>
  )
}
