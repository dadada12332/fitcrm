"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Plus, Download } from "lucide-react"
import { type PaymentRow, providerMeta, statusMeta } from "@/lib/payments"
import { NewPaymentModal } from "./NewPaymentModal"

type Membership = { id: string; name: string; price: number }
type Period = "today" | "week" | "month" | "year"
type ProviderFilter = "all" | "cash" | "click" | "payme" | "uzum"
type StatusFilter = "all" | "paid" | "pending" | "refunded"

function fmtSum(n: number) { return n.toLocaleString("ru-RU") }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function periodStart(p: Period): Date {
  const d = new Date()
  if (p === "today") { d.setHours(0, 0, 0, 0); return d }
  if (p === "week")  { d.setDate(d.getDate() - 7); return d }
  if (p === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d }
  d.setMonth(0); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week",  label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year",  label: "Год" },
]

const PROVIDER_LABELS: { key: ProviderFilter; label: string }[] = [
  { key: "all",   label: "Все" },
  { key: "cash",  label: "Наличные" },
  { key: "click", label: "Click" },
  { key: "payme", label: "Payme" },
  { key: "uzum",  label: "Uzum" },
]

const STATUS_LABELS: { key: StatusFilter; label: string }[] = [
  { key: "all",      label: "Все" },
  { key: "paid",     label: "Оплачено" },
  { key: "pending",  label: "Ожидает" },
  { key: "refunded", label: "Возврат" },
]

function TabGroup<T extends string>({
  items, value, onChange,
}: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg flex-wrap" style={{ background: "#f1f5f9" }}>
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: value === t.key ? "white" : "transparent",
            color: value === t.key ? "#020617" : "#64748b",
            boxShadow: value === t.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function PaymentsClient({ rows, memberships }: { rows: PaymentRow[]; memberships: Membership[] }) {
  const [period, setPeriod]     = useState<Period>("month")
  const [prov, setProv]         = useState<ProviderFilter>("all")
  const [status, setStatus]     = useState<StatusFilter>("all")
  const [query, setQuery]       = useState("")
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    const start = periodStart(period)
    return rows.filter((r) => {
      const date = new Date(r.paidAt ?? r.createdAt)
      if (date < start) return false
      if (prov !== "all" && r.provider !== prov) return false
      if (status !== "all" && r.status !== status) return false
      const q = query.trim().toLowerCase()
      if (q && !r.clientName?.toLowerCase().includes(q) && !r.serviceName?.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, period, prov, status, query])

  const totalFiltered = filtered.reduce((a, r) => a + r.amount, 0)

  return (
    <>
      {/* Toolbar */}
      <div
        className="rounded-xl px-5 py-4 flex flex-col gap-3"
        style={{ background: "white", border: "1px solid #e2e8f0" }}
      >
        {/* Row 1: search + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск клиента или услуги..."
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
              style={{ border: "1px solid #e2e8f0", color: "#020617" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-slate-50"
              style={{ border: "1px solid #e2e8f0", color: "#475569" }}
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ background: "#2563eb" }}
            >
              <Plus className="w-4 h-4" />
              Новая оплата
            </button>
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <TabGroup items={PERIOD_LABELS} value={period} onChange={setPeriod} />
          <TabGroup items={PROVIDER_LABELS} value={prov} onChange={setProv} />
          <TabGroup items={STATUS_LABELS} value={status} onChange={setStatus} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <p className="text-sm font-semibold" style={{ color: "#020617" }}>
            {filtered.length} платежей
          </p>
          {filtered.length > 0 && (
            <p className="text-sm font-semibold" style={{ color: "#2563eb" }}>
              Итого: {fmtSum(totalFiltered)} сум
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center text-sm" style={{ color: "#94a3b8" }}>Платежей нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["Клиент", "Дата", "Услуга", "Сумма", "Метод", "Статус"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "#94a3b8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const pm = providerMeta[row.provider] ?? providerMeta.cash
                  const sm = statusMeta[row.status] ?? statusMeta.pending
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50" style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td className="px-5 py-3">
                        {row.clientId ? (
                          <Link href={`/clients/${row.clientId}`} className="group">
                            <p className="font-medium group-hover:underline" style={{ color: "#020617" }}>
                              {row.clientName ?? "—"}
                            </p>
                            {row.clientPhone && (
                              <p className="text-xs" style={{ color: "#94a3b8" }}>{row.clientPhone}</p>
                            )}
                          </Link>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap" style={{ color: "#475569" }}>
                        {fmtDate(row.paidAt ?? row.createdAt)}
                      </td>
                      <td className="px-5 py-3" style={{ color: row.serviceName ? "#020617" : "#94a3b8" }}>
                        {row.serviceName ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: "#020617" }}>
                        {fmtSum(row.amount)} <span className="font-normal text-xs" style={{ color: "#94a3b8" }}>сум</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pm.bg, color: pm.color }}>
                          {pm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <NewPaymentModal memberships={memberships} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
