"use client"

import { useEffect, useRef, useState, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Clock, CheckCircle2, AlertCircle, AlertTriangle, MoreHorizontal, History, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { VisitRow } from "@/lib/visits"
import { EmptyState } from "./EmptyState"

function RowMenu({ row }: { row: VisitRow }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        style={{ color: "var(--gray-muted)" }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg py-1"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
        >
          <button
            onClick={() => { setOpen(false); router.push(`/clients/${row.clientId}?tab=history`) }}
            className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ color: "var(--on-dark-soft)" }}
          >
            <History className="w-4 h-4 flex-shrink-0" style={{ color: "var(--on-dark-soft)" }} />
            История посещений
          </button>
          <button
            onClick={() => { setOpen(false); router.push(`/clients/${row.clientId}`) }}
            className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ color: "var(--on-dark-soft)" }}
          >
            <RefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: "var(--on-dark-soft)" }} />
            Продлить абонемент
          </button>
        </div>
      )}
    </div>
  )
}

type Filter = "all" | "active" | "expired" | "ending"

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function StatusBadge({ row }: { row: VisitRow }) {
  if (!row.subscriptionStatus || row.subscriptionStatus === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
        Нет абонемента
      </span>
    )
  }
  if (row.subscriptionStatus === "expired" || (row.daysLeft !== null && row.daysLeft < 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
        <AlertCircle className="w-3 h-3" />Истёк
      </span>
    )
  }
  if ((row.daysLeft !== null && row.daysLeft <= 5) || (row.visitsLeft !== null && row.visitsLeft <= 3)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(217,119,6,0.12)", color: "#d97706" }}>
        <AlertTriangle className="w-3 h-3" />Заканчивается
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
      <CheckCircle2 className="w-3 h-3" />Активен
    </span>
  )
}

export function VisitsTable({
  rows, total, page, pageSize,
}: {
  rows: VisitRow[]
  total: number
  page: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [optFilter, setOptFilter] = useState<Filter | null>(null)
  const [, startTransition] = useTransition()
  // Clear optimistic state after the router confirms navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptFilter(null) }, [searchParams])
  const filter = (optFilter ?? searchParams.get("status") ?? "all") as Filter

  const pushParams = useCallback((mutate: (p: URLSearchParams) => void, resetPage = true) => {
    const p = new URLSearchParams(searchParams.toString())
    mutate(p)
    if (resetPage) p.delete("page")
    const qs = p.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  function setFilter(v: Filter) {
    setOptFilter(v)
    pushParams((p) => { if (v && v !== "all") p.set("status", v); else p.delete("status") })
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount - 1)
  function goTo(pnum: number) {
    pushParams((p) => { if (pnum <= 0) p.delete("page"); else p.set("page", String(pnum)) }, false)
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "active", label: "Активные" },
    { key: "ending", label: "Заканчиваются" },
    { key: "expired", label: "Истекшие" },
  ]

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex flex-col items-stretch gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Посещения сегодня</h2>
        </div>

        {/* Filter tabs */}
        <div className="grid w-full grid-cols-2 gap-0.5 rounded-lg p-1 sm:flex sm:w-auto sm:items-center" style={{ background: "var(--card-2)" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="h-7 w-full rounded-md px-3 text-xs font-medium transition-all sm:w-auto"
              style={{
                background: filter === t.key ? "var(--pill-active)" : "transparent",
                color: filter === t.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                boxShadow: filter === t.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6" style={{ color: "#2563eb" }} />}
          title="Пока нет посещений"
          subtitle="Отметьте приход клиента через поиск или QR-код выше — посещения появятся здесь."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Клиент", "Время", "Абонемент", "Статус", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium"
                    style={{ color: "var(--gray-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  {/* Client */}
                  <td className="px-5 py-3">
                    <Link href={`/clients/${row.clientId}`} className="flex items-center gap-3 group w-fit">
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ background: "#3b82f6" }}
                      >
                        {row.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium group-hover:underline" style={{ color: "var(--on-dark)" }}>{row.clientName}</p>
                        {row.clientPhone && (
                          <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{row.clientPhone}</p>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Time */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm" style={{ color: "var(--on-dark-soft)" }} suppressHydrationWarning>
                      {fmtTime(row.checkedInAt)}
                    </span>
                  </td>

                  {/* Membership */}
                  <td className="px-5 py-3">
                    <span style={{ color: row.membershipName ? "var(--on-dark)" : "var(--gray-muted)" }}>
                      {row.membershipName ?? "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <StatusBadge row={row} />
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <RowMenu row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <span className="text-xs" style={{ color: "var(--gray-muted)" }}>
          {total === 0 ? "0 посещений" : `${current * pageSize + 1}–${Math.min(total, current * pageSize + rows.length)} из ${total.toLocaleString("ru-RU")}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
            <div className="flex items-center gap-1">
              {[
                { icon: ChevronsLeft,  to: 0,             dis: current === 0 },
                { icon: ChevronLeft,   to: current - 1,   dis: current === 0 },
                { icon: ChevronRight,  to: current + 1,   dis: current >= pageCount - 1 },
                { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
              ].map(({ icon: Icon, to, dis }, i) => (
                <button key={i} onClick={() => goTo(to)} disabled={dis}
                  className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
