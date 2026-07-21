"use client"

import { useMemo, useState } from "react"
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { pluralDays, membershipStatus, statusMeta, type MembershipRow } from "@/lib/memberships"
import { MembershipRowMenu } from "./MembershipRowMenu"
import { downloadCSV } from "@/lib/csv"

const PAGE_SIZE = 10

function fmtSum(n: number) {
  return n.toLocaleString("ru-RU")
}

function exportMemberships(rows: MembershipRow[]) {
  const today = new Date().toISOString().slice(0, 10)
  downloadCSV(`memberships_${today}.csv`,
    ["Название", "Цена (сум)", "Срок (дней)", "Посещений", "Активных клиентов", "Статус"],
    rows.map((r) => [
      r.name,
      r.price,
      r.durationDays,
      r.visitsLimit ?? "∞",
      r.activeClients,
      r.isActive ? "Активен" : r.archived ? "Архивирован" : "Неактивен",
    ]),
  )
}

export function MembershipsTable({ rows }: { rows: MembershipRow[] }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const cols = "minmax(180px,1.3fr) minmax(130px,1fr) minmax(110px,0.9fr) minmax(130px,1fr) minmax(150px,1fr) minmax(120px,0.9fr) 48px"

  return (
    <div className="rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            placeholder="Поиск"
            className="h-9 w-[239px] pl-9 pr-3 rounded-md text-sm outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportMemberships(filtered)}
            className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}>
            <Download className="w-4 h-4" />Экспорт в CSV
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid items-center px-6 h-12 text-sm"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <span>Название</span>
        <span className="text-right">Срок действия</span>
        <span className="text-right">Посещений</span>
        <span className="text-right">Цена</span>
        <span className="text-right">Активных клиентов</span>
        <span className="text-center">Статус</span>
        <span></span>
      </div>

      {/* Rows */}
      {pageRows.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>Тарифы не найдены</div>
      ) : (
        pageRows.map((r) => (
          <div key={r.id} className="grid items-center px-6 text-sm" style={{ gridTemplateColumns: cols, height: 65, borderBottom: "1px solid var(--border-subtle)" }}>
            <span className="font-medium truncate" style={{ color: "var(--on-dark)" }}>{r.name}</span>
            <span className="text-right" style={{ color: "var(--on-dark-soft)" }}>{pluralDays(r.durationDays)}</span>
            <span className="text-right" style={{ color: "var(--on-dark-soft)" }}>{r.visitsLimit ?? "∞"}</span>
            <span className="text-right" style={{ color: "var(--on-dark-soft)" }}>
              {fmtSum(r.price)} <span style={{ color: "var(--gray-muted)" }}>сум</span>
            </span>
            <span className="text-right" style={{ color: "var(--on-dark-soft)" }}>
              {r.activeClients} <span style={{ color: "var(--gray-muted)" }}>клиентов</span>
            </span>
            <span className="flex justify-center">
              {(() => {
                const sm = statusMeta[membershipStatus(r)]
                return (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>
                    {sm.label}
                  </span>
                )
              })()}
            </span>
            <span className="flex justify-end">
              <MembershipRowMenu row={r} />
            </span>
          </div>
        ))
      )}

      {/* Footer / pagination */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm" style={{ color: "var(--gray-muted)" }}>{filtered.length} тарифов</span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft, to: 0, dis: current === 0 },
              { icon: ChevronLeft, to: current - 1, dis: current === 0 },
              { icon: ChevronRight, to: current + 1, dis: current >= pageCount - 1 },
              { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
            ].map(({ icon: Icon, to, dis }, i) => (
              <button key={i} onClick={() => setPage(to)} disabled={dis}
                className="w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
