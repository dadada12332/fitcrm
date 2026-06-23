"use client"

import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, Download, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { pluralDays, type MembershipRow } from "@/lib/memberships"

const PAGE_SIZE = 10

function fmtSum(n: number) {
  return n.toLocaleString("ru-RU")
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
    <div className="rounded-lg" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
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

      {/* Header */}
      <div className="grid items-center px-6 h-12 text-sm"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
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
        <div className="px-6 py-12 text-sm text-center" style={{ color: "#94a3b8" }}>Тарифы не найдены</div>
      ) : (
        pageRows.map((r) => (
          <div key={r.id} className="grid items-center px-6 text-sm" style={{ gridTemplateColumns: cols, height: 65, borderBottom: "1px solid #f1f5f9" }}>
            <span className="font-medium truncate" style={{ color: "#020617" }}>{r.name}</span>
            <span className="text-right" style={{ color: "#475569" }}>{pluralDays(r.durationDays)}</span>
            <span className="text-right" style={{ color: "#475569" }}>{r.visitsLimit ?? "∞"}</span>
            <span className="text-right" style={{ color: "#475569" }}>
              {fmtSum(r.price)} <span style={{ color: "#94a3b8" }}>сум</span>
            </span>
            <span className="text-right" style={{ color: "#475569" }}>
              {r.activeClients} <span style={{ color: "#94a3b8" }}>клиентов</span>
            </span>
            <span className="flex justify-center">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={r.isActive
                  ? { background: "#dcfce7", color: "#16a34a" }
                  : { background: "#f1f5f9", color: "#64748b" }}>
                {r.isActive ? "Активный" : "Архив"}
              </span>
            </span>
            <span className="flex justify-end">
              <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors" style={{ color: "#94a3b8" }}>
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </span>
          </div>
        ))
      )}

      {/* Footer / pagination */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm" style={{ color: "#94a3b8" }}>{filtered.length} тарифов</span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "#475569" }}>Стр {current + 1} из {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft, to: 0, dis: current === 0 },
              { icon: ChevronLeft, to: current - 1, dis: current === 0 },
              { icon: ChevronRight, to: current + 1, dis: current >= pageCount - 1 },
              { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
            ].map(({ icon: Icon, to, dis }, i) => (
              <button key={i} onClick={() => setPage(to)} disabled={dis}
                className="w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-slate-50"
                style={{ border: "1px solid #e2e8f0", color: "#475569" }}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
