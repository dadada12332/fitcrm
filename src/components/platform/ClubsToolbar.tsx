"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { Search } from "lucide-react"
import { PT } from "./parts"

const STATUS = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "suspended", label: "Заблок." },
]
const PLANS = [
  { key: "all", label: "Все тарифы" },
  { key: "trial", label: "Trial" },
  { key: "starter", label: "Starter" },
  { key: "standard", label: "Standard" },
  { key: "business", label: "Business" },
]

export function ClubsToolbar() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback((next: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString())
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v)
      else params.delete(k)
    })
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, sp])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) push({ q })
    }, 350)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const status = sp.get("status") ?? "all"
  const plan = sp.get("plan") ?? "all"

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PT.textMuted }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск клуба по названию..."
          className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none text-white"
          style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}
        />
      </div>
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => push({ status: s.key })}
            className="h-8 px-3 rounded-md text-xs font-medium transition-colors"
            style={{ background: status === s.key ? "rgba(99,102,241,0.18)" : "transparent", color: status === s.key ? "#a5b4fc" : PT.textMuted }}>
            {s.label}
          </button>
        ))}
      </div>
      <select
        value={plan}
        onChange={(e) => push({ plan: e.target.value })}
        className="h-10 px-3 rounded-lg text-sm outline-none text-white"
        style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}
      >
        {PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </div>
  )
}

export function SearchBox({ placeholder = "Поиск..." }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if ((sp.get("q") ?? "") === q) return
      const params = new URLSearchParams(sp.toString())
      if (q) params.set("q", q); else params.delete("q")
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    }, 350)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="relative flex-1 min-w-[220px] mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PT.textMuted }} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none text-white"
        style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}
      />
    </div>
  )
}

export function Pager({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const go = (p: number) => {
    const params = new URLSearchParams(sp.toString())
    if (p <= 0) params.delete("page")
    else params.set("page", String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex items-center justify-between px-4 h-13 py-3" style={{ borderTop: `1px solid ${PT.panelBorder}` }}>
      <span className="text-xs" style={{ color: PT.textMuted }}>{from}–{to} из {total.toLocaleString("ru-RU")}</span>
      <div className="flex items-center gap-1.5">
        <button disabled={page <= 0} onClick={() => go(page - 1)}
          className="h-8 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
          style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.text }}>
          Назад
        </button>
        <span className="text-xs px-2" style={{ color: PT.textSoft }}>{page + 1} / {pageCount}</span>
        <button disabled={page + 1 >= pageCount} onClick={() => go(page + 1)}
          className="h-8 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
          style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.text }}>
          Вперёд
        </button>
      </div>
    </div>
  )
}
