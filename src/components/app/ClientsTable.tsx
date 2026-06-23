"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { ClientRow, ClientStatus } from "@/lib/clients"
import { ClientsFilterDrawer, type FilterSection } from "./ClientsFilterDrawer"

const PAGE_SIZE = 10

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active:  { label: "Активный",  bg: "#dcfce7", color: "#16a34a" },
  expired: { label: "Истек",     bg: "#fee2e2", color: "#dc2626" },
  frozen:  { label: "Заморожен", bg: "#dbeafe", color: "#2563eb" },
  none:    { label: "Нет",       bg: "#f1f5f9", color: "#64748b" },
}

function fmtBalance(b: number | null) {
  if (b === null) return "—"
  return b.toLocaleString("ru-RU")
}

function inDaysBucket(days: number | null, bucket: string): boolean {
  if (days === null) return false
  switch (bucket) {
    case "0-3": return days >= 0 && days <= 3
    case "4-7": return days >= 4 && days <= 7
    case "8-14": return days >= 8 && days <= 14
    case "14+": return days > 14
    default: return false
  }
}

function matchStatus(r: ClientRow, sel: Set<string>): boolean {
  for (const key of sel) {
    if (key === "active" && r.status === "active") return true
    if (key === "expiring" && r.status === "active" && r.daysLeft !== null && r.daysLeft <= 7) return true
    if (key === "expired" && r.status === "expired") return true
    if (key === "frozen" && r.status === "frozen") return true
  }
  return false
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusSet, setStatusSet] = useState<Set<string>>(new Set())
  const [typeSet, setTypeSet] = useState<Set<string>>(() => {
    const m = searchParams.get("membership")
    return m ? new Set([m]) : new Set()
  })
  const [daysSet, setDaysSet] = useState<Set<string>>(new Set())

  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.membership).filter((m): m is string => !!m))),
    [rows],
  )

  const activeFilterCount = statusSet.size + typeSet.size + daysSet.size

  function toggle(section: FilterSection, value: string) {
    const setter = section === "status" ? setStatusSet : section === "type" ? setTypeSet : setDaysSet
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
    setPage(0)
  }

  function clearFilters() {
    setStatusSet(new Set())
    setTypeSet(new Set())
    setDaysSet(new Set())
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !(r.name.toLowerCase().includes(q) || (r.phone ?? "").toLowerCase().includes(q))) return false
      if (statusSet.size && !matchStatus(r, statusSet)) return false
      if (typeSet.size && !(r.membership && typeSet.has(r.membership))) return false
      if (daysSet.size && !Array.from(daysSet).some((b) => inDaysBucket(r.daysLeft, b))) return false
      return true
    })
  }, [rows, query, statusSet, typeSet, daysSet])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const cols = "minmax(180px,1.1fr) minmax(160px,1fr) minmax(120px,1fr) minmax(140px,1fr) minmax(110px,0.9fr) minmax(120px,1fr) minmax(120px,0.9fr)"

  return (
    <div className="rounded-lg" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {/* Header + toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "#020617" }}>Список клиентов</span>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setFilterOpen(true)}
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Фильтр
            {activeFilterCount > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold flex items-center justify-center text-white"
                style={{ background: "#2563eb" }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2"
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}>
            <Download className="w-4 h-4" />
            Экспорт в excel
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid items-center px-6 h-12 text-sm"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
        <span>Клиент</span>
        <span>Номер телефона</span>
        <span>Абонемент</span>
        <span>Дата окончания</span>
        <span>Остаток</span>
        <span>Баланс</span>
        <span className="text-right">Статус</span>
      </div>

      {/* Rows */}
      {pageRows.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "#94a3b8" }}>Клиенты не найдены</div>
      ) : (
        pageRows.map((r) => {
          const sm = statusMeta[r.status]
          return (
            <div
              key={r.id}
              onClick={() => router.push(`/clients/${r.id}`)}
              className="group grid items-center px-6 text-sm cursor-pointer transition-colors hover:bg-[#f1f5f9] hover:shadow-[inset_3px_0_0_#2563eb]"
              style={{ gridTemplateColumns: cols, height: 65, borderBottom: "1px solid #f1f5f9" }}
            >
              <span className="font-medium truncate transition-colors text-[#020617] group-hover:text-[#2563eb]">{r.name}</span>
              <span style={{ color: "#475569" }}>{r.phone ?? "—"}</span>
              <span style={{ color: "#475569" }}>{r.membership ?? "—"}</span>
              <span style={{ color: "#475569" }}>{r.expiresAt ?? "—"}</span>
              <span style={{ color: "#475569" }}>{r.daysLeft !== null ? `${r.daysLeft} дней` : "—"}</span>
              <span style={{ color: r.balance !== null && r.balance < 0 ? "#dc2626" : "#475569" }}>{fmtBalance(r.balance)}</span>
              <span className="flex justify-end">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>
                  {sm.label}
                </span>
              </span>
            </div>
          )
        })
      )}

      {/* Footer / pagination */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm" style={{ color: "#94a3b8" }}>
          {filtered.length} клиентов
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "#475569" }}>Стр {current + 1} из {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft, to: 0, dis: current === 0 },
              { icon: ChevronLeft, to: current - 1, dis: current === 0 },
              { icon: ChevronRight, to: current + 1, dis: current >= pageCount - 1 },
              { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
            ].map(({ icon: Icon, to, dis }, i) => (
              <button
                key={i}
                onClick={() => setPage(to)}
                disabled={dis}
                className="w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-slate-50"
                style={{ border: "1px solid #e2e8f0", color: "#475569" }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <ClientsFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        status={statusSet}
        type={typeSet}
        days={daysSet}
        typeOptions={typeOptions}
        onToggle={toggle}
        onClear={clearFilters}
      />
    </div>
  )
}
