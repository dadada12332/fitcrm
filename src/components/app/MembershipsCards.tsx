"use client"

import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, Download, Users, Clock, CheckCircle2 } from "lucide-react"
import { pluralDays, membershipStatus, statusMeta, type MembershipRow } from "@/lib/memberships"
import { MembershipRowMenu } from "./MembershipRowMenu"

function fmtSum(n: number) {
  return n.toLocaleString("ru-RU")
}

// Muted/pastel gradient palettes
const CARD_PALETTES = [
  { from: "#4a6fa5", to: "#6b9fd4", accent: "#c8ddf0" },  // slate blue
  { from: "#3d7a5e", to: "#5fa882", accent: "#b8dece" },  // muted teal
  { from: "#6b5b8e", to: "#9278b8", accent: "#d0c4e8" },  // muted violet
  { from: "#9e7b3a", to: "#c4a060", accent: "#ead9b0" },  // muted amber
  { from: "#8e4a5a", to: "#b87080", accent: "#e8c4cc" },  // muted rose
  { from: "#3a7a8e", to: "#60a8c0", accent: "#b8dce8" },  // muted cyan
  { from: "#5a6a7a", to: "#7a8e9e", accent: "#c0ccd8" },  // slate
  { from: "#4a7a5a", to: "#6a9e7a", accent: "#b8d8c4" },  // muted green
]

type Tab = "active" | "archived"

export function MembershipsCards({ rows }: { rows: MembershipRow[] }) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("active")

  const filtered = useMemo(() => {
    const isArchived = tab === "archived"
    const base = rows.filter((r) => (isArchived ? r.archived : !r.archived))
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query, tab])

  const activeCount = rows.filter((r) => !r.archived).length
  const archiveCount = rows.filter((r) => r.archived).length

  return (
    <div className="space-y-4">
      {/* ── Toolbar block ── */}
      <div
        className="rounded-lg flex items-center justify-between gap-4 px-6 py-4"
        style={{ background: "white", border: "1px solid #e2e8f0" }}
      >
        {/* Left: search + tabs */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              className="h-9 w-[220px] pl-9 pr-3 rounded-md text-sm outline-none"
              style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}
            />
          </div>

          {/* Active / Archived tabs */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: "#f1f5f9" }}>
            <button
              onClick={() => setTab("active")}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all"
              style={{
                background: tab === "active" ? "white" : "transparent",
                color: tab === "active" ? "#020617" : "#64748b",
                boxShadow: tab === "active" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Активные
              <span
                className="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center"
                style={{
                  background: tab === "active" ? "#020617" : "#cbd5e1",
                  color: tab === "active" ? "white" : "#475569",
                  fontSize: 10,
                }}
              >
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setTab("archived")}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all"
              style={{
                background: tab === "archived" ? "white" : "transparent",
                color: tab === "archived" ? "#020617" : "#64748b",
                boxShadow: tab === "archived" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Архив
              <span
                className="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center"
                style={{
                  background: tab === "archived" ? "#020617" : "#cbd5e1",
                  color: tab === "archived" ? "white" : "#475569",
                  fontSize: 10,
                }}
              >
                {archiveCount}
              </span>
            </button>
          </div>
        </div>

        {/* Right: filter + export */}
        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}
          >
            <SlidersHorizontal className="w-4 h-4" />Фильтр
          </button>
          <button
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}
          >
            <Download className="w-4 h-4" />Экспорт в excel
          </button>
        </div>
      </div>

      {/* ── Cards block ── */}
      <div className="rounded-lg p-6" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        {filtered.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: "#94a3b8" }}>
            {tab === "archived" ? "Архивных абонементов нет" : "Ничего не найдено"}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                    className="relative px-5 pt-5 pb-6 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}
                  >
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.95)" }}
                      >
                        {meta.label}
                      </span>
                      <div style={{ color: "rgba(255,255,255,0.75)" }}>
                        <MembershipRowMenu row={row} />
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-white leading-tight mb-1.5 relative z-10">
                      {row.name}
                    </h3>
                    <p className="relative z-10" style={{ color: "white" }}>
                      <span className="text-2xl font-bold tracking-tight">{fmtSum(row.price)}</span>
                      <span className="text-sm font-normal ml-1.5" style={{ color: palette.accent }}>сум</span>
                    </p>

                    {/* Decorative blobs */}
                    <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full opacity-15"
                      style={{ background: palette.accent }} />
                    <div className="absolute -bottom-3 right-8 w-14 h-14 rounded-full opacity-10"
                      style={{ background: "white" }} />
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-2.5 px-5 py-4 flex-1">
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
                  <div className="px-5 py-3 flex items-center justify-between"
                    style={{ borderTop: "1px solid #f1f5f9" }}>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-xs" style={{ color: "#94a3b8" }}>
                      {row.activeClients} клиентов
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs mt-5" style={{ color: "#94a3b8" }}>
          {filtered.length} тарифов
        </p>
      </div>
    </div>
  )
}
