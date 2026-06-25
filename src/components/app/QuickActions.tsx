"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, UserPlus, Ticket, Banknote, CalendarPlus, Package } from "lucide-react"

type Action = {
  label: string
  icon: typeof UserPlus
  href?: string
}

const actions: Action[] = [
  { label: "Добавить клиента", icon: UserPlus, href: "/clients" },
  { label: "Продать абонемент", icon: Ticket, href: "/memberships" },
  { label: "Принять оплату", icon: Banknote },
  { label: "Создать занятие", icon: CalendarPlus },
  { label: "Добавить товар", icon: Package },
]

export function QuickActions() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--on-dark)", color: "var(--bg)" }}
      >
        Быстрые действия
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-60 rounded-lg p-1.5 z-20"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(2,6,23,0.12)" }}
        >
          {actions.map(({ label, icon: Icon, href }) => {
            const content = (
              <span className="flex items-center gap-3 w-full">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: href ? "#2563eb" : "var(--gray-muted)" }} />
                <span className="flex-1 text-left">{label}</span>
                {!href && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: "var(--card-2)", color: "var(--gray-muted)" }}
                  >
                    скоро
                  </span>
                )}
              </span>
            )

            if (href) {
              return (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center h-10 px-3 rounded-md text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  style={{ color: "var(--on-dark)" }}
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={label}
                className="flex items-center h-10 px-3 rounded-md text-sm font-medium cursor-not-allowed"
                style={{ color: "var(--gray-muted)" }}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
