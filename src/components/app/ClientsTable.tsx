"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { ClientRow, ClientStatus } from "@/lib/clients"
import { ClientsFilterDrawer, type FilterSection } from "./ClientsFilterDrawer"

const PAGE_SIZE = 10

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active:  { label: "Активный",  bg: "rgba(22,163,74,0.12)",  color: "#16a34a" },
  expired: { label: "Истек",     bg: "rgba(220,38,38,0.12)",  color: "#dc2626" },
  frozen:  { label: "Заморожен", bg: "rgba(37,99,235,0.12)",  color: "#2563eb" },
  none:    { label: "Нет",       bg: "var(--card-2)",          color: "var(--on-dark-soft)" },
}

const genderLabel: Record<string, string> = { male: "Мужской", female: "Женский" }

function fmtBirthDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function inDaysBucket(days: number | null, bucket: string): boolean {
  if (days === null) return false
  switch (bucket) {
    case "0-3":  return days >= 0 && days <= 3
    case "4-7":  return days >= 4 && days <= 7
    case "8-14": return days >= 8 && days <= 14
    case "14+":  return days > 14
    default:     return false
  }
}

function matchStatus(r: ClientRow, sel: Set<string>): boolean {
  for (const key of sel) {
    if (key === "active"   && r.status === "active") return true
    if (key === "expiring" && r.status === "active" && r.daysLeft !== null && r.daysLeft <= 7) return true
    if (key === "expired"  && r.status === "expired") return true
    if (key === "frozen"   && r.status === "frozen") return true
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
    setStatusSet(new Set()); setTypeSet(new Set()); setDaysSet(new Set()); setPage(0)
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

  const cols = "minmax(160px,1.1fr) minmax(160px,1fr) minmax(110px,0.9fr) minmax(110px,0.9fr) minmax(140px,1fr) minmax(120px,1fr) minmax(110px,0.9fr)"

  return (
    <div className="rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 sm:py-5">
        <span className="text-xl font-medium tracking-[-0.12px] flex-1 min-w-0" style={{ color: "var(--on-dark)" }}>Список клиентов</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[160px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0) }}
              placeholder="Поиск"
              className="h-9 w-full sm:w-[200px] pl-9 pr-3 rounded-md text-sm outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
            />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2 flex-shrink-0"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
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
        </div>
      </div>

      {/* Header row */}
      <div className="grid items-center px-6 h-12 text-sm"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <span>Клиент</span>
        <span>Телефон</span>
        <span>Дата рожд.</span>
        <span>Пол</span>
        <span>Абонемент</span>
        <span>Источник</span>
        <span className="text-right">Статус</span>
      </div>

      {/* Data rows */}
      {pageRows.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>Клиенты не найдены</div>
      ) : (
        pageRows.map((r) => {
          const sm = statusMeta[r.status]
          return (
            <div
              key={r.id}
              onClick={() => router.push(`/clients/${r.id}`)}
              className="group grid items-center px-6 text-sm cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:shadow-[inset_3px_0_0_#2563eb]"
              style={{ gridTemplateColumns: cols, height: 65, borderBottom: "1px solid var(--border-subtle)" }}
            >
              <span className="font-medium truncate transition-colors text-[var(--on-dark)] group-hover:text-[#2563eb]">{r.name}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{r.phone ?? "—"}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{fmtBirthDate(r.birthDate)}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{r.gender ? genderLabel[r.gender] ?? "—" : "—"}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{r.membership ?? "—"}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{r.source ?? "—"}</span>
              <span className="flex justify-end">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>
                  {sm.label}
                </span>
              </span>
            </div>
          )
        })
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm" style={{ color: "var(--gray-muted)" }}>{filtered.length} клиентов</span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft,  to: 0,              dis: current === 0 },
              { icon: ChevronLeft,   to: current - 1,    dis: current === 0 },
              { icon: ChevronRight,  to: current + 1,    dis: current >= pageCount - 1 },
              { icon: ChevronsRight, to: pageCount - 1,  dis: current >= pageCount - 1 },
            ].map(({ icon: Icon, to, dis }, i) => (
              <button
                key={i}
                onClick={() => setPage(to)}
                disabled={dis}
                className="w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
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
