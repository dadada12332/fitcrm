"use client"

import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, Download, Users, Clock, Infinity, CheckCircle2 } from "lucide-react"
import { pluralDays, membershipStatus, statusMeta, type MembershipRow } from "@/lib/memberships"
import { MembershipRowMenu } from "./MembershipRowMenu"

function fmtSum(n: number) {
  return n.toLocaleString("ru-RU")
}

const CARD_PALETTES = [
  { from: "#1e3a5f", to: "#2563eb", accent: "#93c5fd" },  // blue
  { from: "#064e3b", to: "#059669", accent: "#6ee7b7" },  // emerald
  { from: "#581c87", to: "#7c3aed", accent: "#c4b5fd" },  // violet
  { from: "#92400e", to: "#d97706", accent: "#fde68a" },  // amber
  { from: "#881337", to: "#e11d48", accent: "#fda4af" },  // rose
  { from: "#0e4f6e", to: "#0891b2", accent: "#67e8f9" },  // cyan
  { from: "#1c1917", to: "#57534e", accent: "#d6d3d1" },  // stone
  { from: "#14532d", to: "#16a34a", accent: "#86efac" },  // green
]

function VisitsBadge({ v }: { v: number | null }) {
  if (v === null) return <Infinity className="w-5 h-5" />
  return <span>{v}</span>
}

export function MembershipsCards({ rows }: { rows: MembershipRow[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="rounded-lg" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className="h-9 w-[239px] pl-9 pr-3 rounded-md text-sm outline-none"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}>
            <SlidersHorizontal className="w-4 h-4" />Фильтр
          </button>
          <button className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}>
            <Download className="w-4 h-4" />Экспорт в excel
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        style={{ borderTop: "1px solid #e2e8f0", paddingTop: 24 }}>
        {filtered.length === 0 && (
          <p className="col-span-full text-sm py-10 text-center" style={{ color: "#94a3b8" }}>
            Ничего не найдено
          </p>
        )}
        {filtered.map((row, i) => {
          const palette = CARD_PALETTES[i % CARD_PALETTES.length]
          const status = membershipStatus(row)
          const meta = statusMeta[status]

          return (
            <div
              key={row.id}
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              {/* Colored header */}
              <div
                className="relative px-5 pt-5 pb-6"
                style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}
              >
                {/* Status + menu row */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
                  >
                    {meta.label}
                  </span>
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>
                    <MembershipRowMenu row={row} />
                  </div>
                </div>

                {/* Name */}
                <h3 className="text-xl font-semibold text-white leading-tight mb-1">{row.name}</h3>

                {/* Price */}
                <p className="text-3xl font-bold text-white tracking-tight">
                  {fmtSum(row.price)}
                  <span className="text-base font-normal ml-1.5" style={{ color: palette.accent }}>сум</span>
                </p>

                {/* Decorative circle */}
                <div
                  className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-20"
                  style={{ background: palette.accent }}
                />
                <div
                  className="absolute -bottom-10 -right-2 w-16 h-16 rounded-full opacity-10"
                  style={{ background: "white" }}
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-3 px-5 py-4 flex-1">
                <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>Срок — <strong style={{ color: "#020617" }}>{pluralDays(row.durationDays)}</strong></span>
                </div>

                <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Посещений — <strong style={{ color: "#020617" }}>
                    {row.visitsLimit === null ? "∞" : row.visitsLimit}
                  </strong></span>
                </div>

                <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span>Клиентов — <strong style={{ color: "#020617" }}>{row.activeClients}</strong></span>
                </div>
              </div>

              {/* Footer */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: "1px solid #f1f5f9" }}
              >
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  {row.activeClients} {row.activeClients === 1 ? "клиент" : "клиентов"}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer count */}
      <div className="px-6 py-4 text-xs" style={{ borderTop: "1px solid #e2e8f0", color: "#94a3b8" }}>
        {filtered.length} тарифов
      </div>
    </div>
  )
}
