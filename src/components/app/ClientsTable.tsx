"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown } from "lucide-react"
import type { ClientRow, ClientStatus } from "@/lib/clients"
import { ClientsFilterDrawer, type FilterSection } from "./ClientsFilterDrawer"

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active:  { label: "Активный",  bg: "rgba(22,163,74,0.12)",  color: "#16a34a" },
  expired: { label: "Истек",     bg: "rgba(220,38,38,0.12)",  color: "#dc2626" },
  frozen:  { label: "Заморожен", bg: "rgba(37,99,235,0.12)",  color: "#2563eb" },
  none:    { label: "Нет",       bg: "var(--card-2)",          color: "var(--on-dark-soft)" },
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ClientsTable({
  rows,
  total,
  page,
  pageSize,
  membershipNames,
}: {
  rows: ClientRow[]
  total: number
  page: number
  pageSize: number
  membershipNames: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filterOpen, setFilterOpen] = useState(false)

  const statusSet = new Set(searchParams.getAll("status"))
  const typeSet   = new Set(searchParams.getAll("membership"))
  const daysSet   = new Set(searchParams.getAll("days"))
  const sort      = searchParams.get("sort") ?? ""
  const urlQuery  = searchParams.get("q") ?? ""
  const activeFilterCount = statusSet.size + typeSet.size + daysSet.size

  // Обновление URL — сервер перерисует страницу с новой выборкой.
  const pushParams = useCallback((mutate: (p: URLSearchParams) => void, resetPage = true) => {
    const p = new URLSearchParams(searchParams.toString())
    mutate(p)
    if (resetPage) p.delete("page")
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  // ── Поиск (debounce) ──
  const [search, setSearch] = useState(urlQuery)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { setSearch(urlQuery) }, [urlQuery])
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if (search === urlQuery) return
      pushParams((p) => { if (search.trim()) p.set("q", search.trim()); else p.delete("q") })
    }, 350)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // ── Фильтры (мультивыбор через повторяющиеся параметры) ──
  function toggle(section: FilterSection, value: string) {
    const key = section === "status" ? "status" : section === "type" ? "membership" : "days"
    pushParams((p) => {
      const cur = p.getAll(key)
      p.delete(key)
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      next.forEach((v) => p.append(key, v))
    })
  }
  function clearFilters() {
    pushParams((p) => { p.delete("status"); p.delete("membership"); p.delete("days") })
  }

  // ── Сортировка (серверная, в URL) ──
  function toggleSort(asc: string, desc: string) {
    pushParams((p) => {
      if (sort === asc) p.set("sort", desc)
      else if (sort === desc) p.delete("sort")
      else p.set("sort", asc)
    }, false)
  }
  function SortIcon({ asc, desc }: { asc: string; desc: string }) {
    if (sort === asc) return <ArrowUp className="w-3 h-3 inline ml-1" />
    if (sort === desc) return <ArrowDown className="w-3 h-3 inline ml-1" />
    return null
  }

  // ── Пагинация ──
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount - 1)
  function goTo(p: number) {
    pushParams((sp) => { if (p <= 0) sp.delete("page"); else sp.set("page", String(p)) }, false)
  }
  const from = total === 0 ? 0 : current * pageSize + 1
  const to = Math.min(total, current * pageSize + rows.length)

  const cols = "minmax(140px,1.2fr) minmax(130px,1fr) minmax(130px,1fr) minmax(110px,0.9fr) minmax(140px,1fr) minmax(120px,0.9fr) minmax(110px,0.9fr) minmax(90px,0.7fr)"

  return (
    <div className="rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 sm:py-5">
        <span className="text-xl font-medium tracking-[-0.12px] flex-1 min-w-0" style={{ color: "var(--on-dark)" }}>Список клиентов</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[160px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      {/* Table wrapper */}
      <div className="overflow-x-auto">
        {/* Header row */}
        <div className="grid items-center px-6 h-12 text-sm min-w-[960px]"
          style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
          <button onClick={() => toggleSort("name_asc", "name_desc")} className="text-left flex items-center hover:text-[var(--on-dark)] transition-colors">
            Имя <SortIcon asc="name_asc" desc="name_desc" />
          </button>
          <span>Телефон</span>
          <span>Абонемент</span>
          <span>Статус</span>
          <span>Последнее посещение</span>
          <span>Осталось посещений</span>
          <span>Источник</span>
          <button onClick={() => toggleSort("debt_asc", "debt_desc")} className="text-right flex items-center justify-end hover:text-[var(--on-dark)] transition-colors">
            Долг <SortIcon asc="debt_asc" desc="debt_desc" />
          </button>
        </div>

        {/* Data rows */}
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>
            {urlQuery || activeFilterCount > 0 ? "Клиенты не найдены" : "Пока нет клиентов"}
          </div>
        ) : (
          rows.map((r) => {
            const sm = statusMeta[r.status] ?? statusMeta.none
            return (
              <Link
                key={r.id}
                href={`/clients/${r.id}`}
                prefetch={false}
                className="group grid items-center px-6 text-sm cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:shadow-[inset_3px_0_0_#2563eb] min-w-[960px] focus-visible:outline-none focus-visible:shadow-[inset_3px_0_0_#2563eb] focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800/80"
                style={{ gridTemplateColumns: cols, height: 65, borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span className="font-medium truncate transition-colors text-[var(--on-dark)] group-hover:text-[#2563eb]">{r.name}</span>
                <span style={{ color: "var(--on-dark-soft)" }}>{r.phone ?? "—"}</span>
                <span className="truncate" style={{ color: "var(--on-dark-soft)" }}>{r.membership ?? "—"}</span>
                <span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>
                    {sm.label}
                  </span>
                </span>
                <span style={{ color: "var(--on-dark-soft)" }} suppressHydrationWarning>{fmtDate(r.lastVisit)}</span>
                <span style={{ color: r.visitsLeft !== null && r.visitsLeft <= 2 ? "#dc2626" : "var(--on-dark-soft)" }}>
                  {r.visitsLeft !== null ? r.visitsLeft : "—"}
                </span>
                <span style={{ color: "var(--on-dark-soft)" }}>{r.source ?? "—"}</span>
                <span className="text-right font-medium" style={{ color: r.debt > 0 ? "#dc2626" : "var(--on-dark-soft)" }}>
                  {r.debt > 0 ? `${r.debt.toLocaleString("ru-RU")} сум` : "—"}
                </span>
              </Link>
            )
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm" style={{ color: "var(--gray-muted)" }}>
          {total === 0 ? "0 клиентов" : `${from}–${to} из ${total.toLocaleString("ru-RU")}`}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft,  to: 0,              dis: current === 0 },
              { icon: ChevronLeft,   to: current - 1,    dis: current === 0 },
              { icon: ChevronRight,  to: current + 1,    dis: current >= pageCount - 1 },
              { icon: ChevronsRight, to: pageCount - 1,  dis: current >= pageCount - 1 },
            ].map(({ icon: Icon, to: dest, dis }, i) => (
              <button
                key={i}
                onClick={() => goTo(dest)}
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
        typeOptions={membershipNames}
        onToggle={toggle}
        onClear={clearFilters}
      />
    </div>
  )
}
