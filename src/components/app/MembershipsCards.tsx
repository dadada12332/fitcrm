"use client"

import { useMemo, useState } from "react"
import { Search, Users, Clock, CheckCircle2 } from "lucide-react"
import { pluralDays, membershipStatus, statusMeta, type MembershipRow } from "@/lib/memberships"
import { MembershipRowMenu } from "./MembershipRowMenu"

function fmtSum(n: number) {
  return n.toLocaleString("ru-RU")
}

const CARD_PALETTES = [
  { from: "#2563eb", to: "#3b82f6", accent: "rgba(37,99,235,0.3)" },  // blue
  { from: "#059669", to: "#10b981", accent: "#a7f3d0" },  // emerald
  { from: "#7c3aed", to: "#8b5cf6", accent: "#ddd6fe" },  // violet
  { from: "#d97706", to: "#f59e0b", accent: "#fde68a" },  // amber
  { from: "#dc2626", to: "#ef4444", accent: "rgba(220,38,38,0.3)" },  // red
  { from: "#0891b2", to: "#06b6d4", accent: "#a5f3fc" },  // cyan
  { from: "#4338ca", to: "#6366f1", accent: "#c7d2fe" },  // indigo
  { from: "#0f766e", to: "#14b8a6", accent: "#99f6e4" },  // teal
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
        className="flex flex-col items-stretch gap-3 rounded-lg px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              className="h-9 w-full rounded-md pl-9 pr-3 text-sm outline-none sm:w-[220px]"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
            />
          </div>

          {/* Active / Archived tabs */}
          <div className="flex w-full items-center gap-0.5 rounded-lg p-1 sm:w-auto" style={{ background: "var(--card-2)" }}>
            <button
              onClick={() => setTab("active")}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all sm:flex-none"
              style={{
                background: tab === "active" ? "var(--pill-active)" : "transparent",
                color: tab === "active" ? "var(--on-dark)" : "var(--on-dark)",
                boxShadow: tab === "active" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                opacity: tab === "active" ? 1 : 0.55,
              }}
            >
              Активные
              <span
                className="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center"
                style={{
                  background: tab === "active" ? "var(--on-dark)" : "var(--on-dark)",
                  color: tab === "active" ? "var(--bg)" : "var(--bg)",
                  fontSize: 10,
                }}
              >
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setTab("archived")}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all sm:flex-none"
              style={{
                background: tab === "archived" ? "var(--pill-active)" : "transparent",
                color: tab === "archived" ? "var(--on-dark)" : "var(--on-dark)",
                boxShadow: tab === "archived" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                opacity: tab === "archived" ? 1 : 0.55,
              }}
            >
              Архив
              <span
                className="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center"
                style={{
                  background: tab === "archived" ? "var(--on-dark)" : "var(--on-dark)",
                  color: tab === "archived" ? "var(--bg)" : "var(--bg)",
                  fontSize: 10,
                }}
              >
                {archiveCount}
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Cards block ── */}
      <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {filtered.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: "var(--gray-muted)" }}>
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
                  className="rounded-lg flex flex-col relative"
                  style={{ border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  {/* Menu floats at card level so dropdown isn't clipped by header overflow-hidden */}
                  <div className="absolute top-3 right-3 z-20 flex">
                    <MembershipRowMenu row={row} onDark />
                  </div>

                  {/* Colored header */}
                  <div
                    className="relative px-5 pt-5 pb-6 overflow-hidden rounded-t-2xl"
                    style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}
                  >
                    <div className="flex items-center mb-4 relative z-10">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.95)" }}
                      >
                        {meta.label}
                      </span>
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
                      style={{ background: "var(--card)" }} />
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-2.5 px-5 py-4 flex-1">
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>Срок — <strong style={{ color: "var(--on-dark)" }}>{pluralDays(row.durationDays)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Посещений — <strong style={{ color: "var(--on-dark)" }}>
                        {row.visitsLimit === null ? <span style={{ fontSize: "1.2em", lineHeight: 1 }}>∞</span> : row.visitsLimit}
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span>Клиентов — <strong style={{ color: "var(--on-dark)" }}>{row.activeClients}</strong></span>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs mt-5" style={{ color: "var(--gray-muted)" }}>
          {filtered.length} тарифов
        </p>
      </div>
    </div>
  )
}
