"use client"

import { useEffect, useRef, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock, CheckCircle2, AlertCircle, AlertTriangle, MoreHorizontal, History, RefreshCw } from "lucide-react"
import type { VisitRow } from "@/lib/visits"

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
        className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-slate-100"
        style={{ color: "#94a3b8" }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg py-1"
          style={{ background: "white", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
        >
          <button
            onClick={() => { setOpen(false); router.push(`/clients/${row.clientId}?tab=history`) }}
            className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left transition-colors hover:bg-slate-50"
            style={{ color: "#334155" }}
          >
            <History className="w-4 h-4 flex-shrink-0" style={{ color: "#64748b" }} />
            История посещений
          </button>
          <button
            onClick={() => { setOpen(false); router.push(`/clients/${row.clientId}`) }}
            className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left transition-colors hover:bg-slate-50"
            style={{ color: "#334155" }}
          >
            <RefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: "#64748b" }} />
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
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#64748b" }}>
        Нет абонемента
      </span>
    )
  }
  if (row.subscriptionStatus === "expired" || (row.daysLeft !== null && row.daysLeft < 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fee2e2", color: "#dc2626" }}>
        <AlertCircle className="w-3 h-3" />Истёк
      </span>
    )
  }
  if ((row.daysLeft !== null && row.daysLeft <= 5) || (row.visitsLeft !== null && row.visitsLeft <= 3)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fef3c7", color: "#d97706" }}>
        <AlertTriangle className="w-3 h-3" />Заканчивается
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#dcfce7", color: "#16a34a" }}>
      <CheckCircle2 className="w-3 h-3" />Активен
    </span>
  )
}

function getFilter(row: VisitRow): Filter {
  if (!row.subscriptionStatus || row.subscriptionStatus === "expired") return "expired"
  if ((row.daysLeft !== null && row.daysLeft <= 5) || (row.visitsLeft !== null && row.visitsLeft <= 3)) return "ending"
  return "active"
}

export function VisitsTable({ rows: initialRows }: { rows: VisitRow[] }) {
  const [filter, setFilter] = useState<Filter>("all")

  const rows = useMemo(() => {
    if (filter === "all") return initialRows
    return initialRows.filter((r) => getFilter(r) === filter)
  }, [initialRows, filter])

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "active", label: "Активные" },
    { key: "ending", label: "Заканчиваются" },
    { key: "expired", label: "Истекшие" },
  ]

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" style={{ color: "#64748b" }} />
          <h2 className="text-sm font-semibold" style={{ color: "#020617" }}>Посещения сегодня</h2>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: "#f1f5f9" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all"
              style={{
                background: filter === t.key ? "white" : "transparent",
                color: filter === t.key ? "#020617" : "#64748b",
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
        <div className="py-14 text-center text-sm" style={{ color: "#94a3b8" }}>
          Посещений нет
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                {["Клиент", "Время", "Абонемент", "Статус", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium"
                    style={{ color: "#94a3b8" }}
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
                  className="transition-colors hover:bg-slate-50"
                  style={{ borderBottom: "1px solid #f8fafc" }}
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
                        <p className="font-medium group-hover:underline" style={{ color: "#020617" }}>{row.clientName}</p>
                        {row.clientPhone && (
                          <p className="text-xs" style={{ color: "#94a3b8" }}>{row.clientPhone}</p>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Time */}
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm" style={{ color: "#475569" }}>
                      {fmtTime(row.checkedInAt)}
                    </span>
                  </td>

                  {/* Membership */}
                  <td className="px-5 py-3">
                    <span style={{ color: row.membershipName ? "#020617" : "#94a3b8" }}>
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

      {rows.length > 0 && (
        <div className="px-5 py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
          <span className="text-xs" style={{ color: "#94a3b8" }}>{rows.length} посещений</span>
        </div>
      )}
    </div>
  )
}
