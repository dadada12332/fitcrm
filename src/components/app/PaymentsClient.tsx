"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Plus, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { type PaymentRow, providerMeta, statusMeta } from "@/lib/payments"
import { NewPaymentModal } from "./NewPaymentModal"
import { downloadCSV } from "@/lib/csv"

const PAGE_SIZE = 10

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
    <div className="flex items-center gap-0.5 p-1 rounded-lg flex-wrap" style={{ background: "var(--card-2)" }}>
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: value === t.key ? "var(--pill-active)" : "transparent",
            color: value === t.key ? "var(--on-dark)" : "var(--on-dark-soft)",
            boxShadow: value === t.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

const PROVIDER_LABELS_RU: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
const STATUS_LABELS_RU:   Record<string, string> = { paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат" }

function exportPayments(rows: PaymentRow[]) {
  const today = new Date().toISOString().slice(0, 10)
  downloadCSV(`payments_${today}.csv`,
    ["Дата", "Клиент", "Телефон", "Услуга", "Сумма (сум)", "Способ оплаты", "Статус"],
    rows.map((r) => [
      r.paidAt ? new Date(r.paidAt).toLocaleDateString("ru-RU") : new Date(r.createdAt).toLocaleDateString("ru-RU"),
      r.clientName ?? "—",
      r.clientPhone ?? "—",
      r.serviceName ?? "—",
      r.amount,
      PROVIDER_LABELS_RU[r.provider] ?? r.provider,
      STATUS_LABELS_RU[r.status] ?? r.status,
    ]),
  )
}

export function PaymentsClient({ rows, memberships }: { rows: PaymentRow[]; memberships: Membership[] }) {
  const [period, setPeriod]     = useState<Period>("month")
  const [prov, setProv]         = useState<ProviderFilter>("all")
  const [status, setStatus]     = useState<StatusFilter>("all")
  const [query, setQuery]       = useState("")
  const [page, setPage]         = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  function resetPage() { setPage(0) }

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current   = Math.min(page, pageCount - 1)
  const pageRows  = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  const totalFiltered = filtered.reduce((a, r) => a + r.amount, 0)

  return (
    <>
      {/* Toolbar */}
      <div
        className="rounded-lg px-5 py-4 flex flex-col gap-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Row 1: search + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPage() }}
              placeholder="Поиск клиента или услуги..."
              className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none"
              style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportPayments(filtered)}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
            >
              <Download className="w-4 h-4" />
              Экспорт в CSV
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="h-9 px-4 rounded-md text-sm font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ background: "#2563eb" }}
            >
              <Plus className="w-4 h-4" />
              Новая оплата
            </button>
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <TabGroup items={PERIOD_LABELS} value={period} onChange={(v) => { setPeriod(v); resetPage() }} />
          <TabGroup items={PROVIDER_LABELS} value={prov} onChange={(v) => { setProv(v); resetPage() }} />
          <TabGroup items={STATUS_LABELS} value={status} onChange={(v) => { setStatus(v); resetPage() }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
            {filtered.length} платежей
          </p>
          {filtered.length > 0 && (
            <p className="text-sm font-semibold" style={{ color: "#2563eb" }}>
              Итого: {fmtSum(totalFiltered)} сум
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center text-sm" style={{ color: "var(--gray-muted)" }}>Платежей нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Клиент", "Дата", "Услуга", "Сумма", "Метод", "Статус"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const pm = providerMeta[row.provider] ?? providerMeta.cash
                  const sm = statusMeta[row.status] ?? statusMeta.pending
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-5 py-3">
                        {row.clientId ? (
                          <Link href={`/clients/${row.clientId}`} className="group">
                            <p className="font-medium group-hover:underline" style={{ color: "var(--on-dark)" }}>
                              {row.clientName ?? "—"}
                            </p>
                            {row.clientPhone && (
                              <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{row.clientPhone}</p>
                            )}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--gray-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--on-dark-soft)" }}>
                        {fmtDate(row.paidAt ?? row.createdAt)}
                      </td>
                      <td className="px-5 py-3" style={{ color: row.serviceName ? "var(--on-dark)" : "var(--gray-muted)" }}>
                        {row.serviceName ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: "var(--on-dark)" }}>
                        {fmtSum(row.amount)} <span className="font-normal text-xs" style={{ color: "var(--gray-muted)" }}>сум</span>
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <span className="text-sm" style={{ color: "var(--gray-muted)" }}>{filtered.length} платежей</span>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
            <div className="flex items-center gap-1">
              {[
                { icon: ChevronsLeft,  to: 0,             dis: current === 0 },
                { icon: ChevronLeft,   to: current - 1,   dis: current === 0 },
                { icon: ChevronRight,  to: current + 1,   dis: current >= pageCount - 1 },
                { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
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
      </div>

      {modalOpen && (
        <NewPaymentModal memberships={memberships} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
