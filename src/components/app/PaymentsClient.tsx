"use client"

import { useState, useEffect, useRef, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, Plus, Download, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard, ArrowUp, ArrowDown, Scale } from "lucide-react"
import { type PaymentRow, providerMeta, statusMeta } from "@/lib/payments"
import { NewPaymentModal } from "./NewPaymentModal"
import { EmptyState } from "./EmptyState"
import { exportPaymentsCsvAction } from "@/app/(app)/payments/actions"
import { downloadBlob } from "@/lib/csv"
import { toast } from "sonner"

type Membership = { id: string; name: string; price: number }

function fmtSum(n: number) { return n.toLocaleString("ru-RU") }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
}
function periodFrom(period: string): string {
  const d = new Date()
  if (period === "today") d.setHours(0, 0, 0, 0)
  else if (period === "week") d.setDate(d.getDate() - 7)
  else if (period === "year") { d.setMonth(0); d.setDate(1); d.setHours(0, 0, 0, 0) }
  else { d.setDate(1); d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

const PERIOD_LABELS = [
  { key: "today", label: "Сегодня" },
  { key: "week",  label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year",  label: "Год" },
]
const PROVIDER_LABELS = [
  { key: "all",   label: "Все" },
  { key: "cash",  label: "Наличные" },
  { key: "click", label: "Click" },
  { key: "payme", label: "Payme" },
  { key: "uzum",  label: "Uzum" },
]
const STATUS_LABELS = [
  { key: "all",      label: "Все" },
  { key: "paid",     label: "Оплачено" },
  { key: "pending",  label: "Ожидает" },
  { key: "refunded", label: "Возврат" },
]

function TabGroup({ items, value, onChange }: { items: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
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

export function PaymentsClient({
  rows, total, totalAmount, page, pageSize, memberships, connectedProviders = [],
}: {
  rows: PaymentRow[]
  total: number
  totalAmount: number
  page: number
  pageSize: number
  memberships: Membership[]
  connectedProviders?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Оптимистичные значения фильтров: подсвечиваем выбранный таб мгновенно,
  // не дожидаясь серверного перехода (иначе клик «висит» ~2с без реакции).
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()
  // Clear optimistic URL state after the router confirms navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimistic({}) }, [searchParams])

  const period = optimistic.period ?? searchParams.get("period") ?? "month"
  const prov   = optimistic.provider ?? searchParams.get("provider") ?? "all"
  const status = optimistic.status ?? searchParams.get("status") ?? "all"
  const sort   = searchParams.get("sort") ?? ""
  const urlQuery = searchParams.get("q") ?? ""

  const [modalOpen, setModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const pushParams = useCallback((mutate: (p: URLSearchParams) => void, resetPage = true) => {
    const p = new URLSearchParams(searchParams.toString())
    mutate(p)
    if (resetPage) p.delete("page")
    const qs = p.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  function setParam(key: string, value: string, defaultVal: string) {
    setOptimistic((o) => ({ ...o, [key]: value }))
    pushParams((p) => { if (value && value !== defaultVal) p.set(key, value); else p.delete(key) })
  }

  // Поиск (debounce)
  const [search, setSearch] = useState(urlQuery)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Browser back/forward can update the URL independently of the input.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function toggleAmountSort() {
    pushParams((p) => {
      if (sort === "amount_desc") p.set("sort", "amount_asc")
      else if (sort === "amount_asc") p.delete("sort")
      else p.set("sort", "amount_desc")
    }, false)
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount - 1)
  function goTo(pnum: number) {
    pushParams((p) => { if (pnum <= 0) p.delete("page"); else p.set("page", String(pnum)) }, false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await exportPaymentsCsvAction({ search: urlQuery, provider: prov, status, from: periodFrom(period), sort })
      if (res.error || !res.csv) {
        toast.error(res.error ?? "Не удалось подготовить экспорт")
        return
      }
      downloadBlob(
        `fitcrm-payments-${new Date().toISOString().slice(0, 10)}.csv`,
        new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8;" }),
      )
      toast.success("Экспорт платежей готов")
    } catch {
      toast.error("Не удалось скачать экспорт")
    } finally { setExporting(false) }
  }

  const hasFilters = urlQuery.trim() || prov !== "all" || status !== "all"

  return (
    <>
      {/* Toolbar */}
      <div className="rounded-lg px-5 py-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {/* Row 1: search + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск клиента или услуги..."
              className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none"
              style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            {connectedProviders.length > 0 && (
              <Link
                href="/payments/reconcile"
                className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
              >
                <Scale className="w-4 h-4" />
                Сверка
              </Link>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60"
              style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
          <TabGroup items={PERIOD_LABELS} value={period} onChange={(v) => setParam("period", v, "month")} />
          <TabGroup items={PROVIDER_LABELS} value={prov} onChange={(v) => setParam("provider", v, "all")} />
          <TabGroup items={STATUS_LABELS} value={status} onChange={(v) => setParam("status", v, "all")} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
            {total.toLocaleString("ru-RU")} платежей
          </p>
          {total > 0 && (
            <p className="text-sm font-semibold" style={{ color: "#2563eb" }}>
              Итого: {fmtSum(totalAmount)} сум
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />}
              title="Ничего не найдено"
              subtitle="Попробуйте изменить период, фильтр или поисковый запрос."
            />
          ) : (
            <EmptyState
              icon={<CreditCard className="w-6 h-6" style={{ color: "#2563eb" }} />}
              title="Пока нет оплат"
              subtitle="Здесь будут все платежи клуба. Создайте первую оплату, чтобы начать вести финансы."
              action={
                <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>
                  <Plus className="w-4 h-4" /> Новая оплата
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Клиент", "Дата", "Услуга", "", "Метод", "Статус"].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>
                      {i === 3 ? (
                        <button onClick={toggleAmountSort} className="flex items-center hover:text-[var(--on-dark)] transition-colors">
                          Сумма
                          {sort === "amount_desc" && <ArrowDown className="w-3 h-3 ml-1" />}
                          {sort === "amount_asc" && <ArrowUp className="w-3 h-3 ml-1" />}
                        </button>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pm = providerMeta[row.provider] ?? providerMeta.cash
                  const sm = statusMeta[row.status] ?? statusMeta.pending
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-5 py-3">
                        {row.clientId ? (
                          <Link href={`/clients/${row.clientId}`} className="group">
                            <p className="font-medium group-hover:underline" style={{ color: "var(--on-dark)" }}>{row.clientName ?? "—"}</p>
                            {row.clientPhone && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{row.clientPhone}</p>}
                          </Link>
                        ) : (<span style={{ color: "var(--gray-muted)" }}>—</span>)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--on-dark-soft)" }} suppressHydrationWarning>{fmtDate(row.paidAt ?? row.createdAt)}</td>
                      <td className="px-5 py-3" style={{ color: row.serviceName ? "var(--on-dark)" : "var(--gray-muted)" }}>{row.serviceName ?? "—"}</td>
                      <td className="px-5 py-3 font-semibold whitespace-nowrap" style={{ color: "var(--on-dark)" }}>
                        {fmtSum(row.amount)} <span className="font-normal text-xs" style={{ color: "var(--gray-muted)" }}>сум</span>
                      </td>
                      <td className="px-5 py-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span></td>
                      <td className="px-5 py-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <span className="text-sm" style={{ color: "var(--gray-muted)" }}>
            {total === 0 ? "0 платежей" : `${current * pageSize + 1}–${Math.min(total, current * pageSize + rows.length)} из ${total.toLocaleString("ru-RU")}`}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Стр {current + 1} из {pageCount}</span>
            <div className="flex items-center gap-1">
              {[
                { icon: ChevronsLeft,  to: 0,             dis: current === 0 },
                { icon: ChevronLeft,   to: current - 1,   dis: current === 0 },
                { icon: ChevronRight,  to: current + 1,   dis: current >= pageCount - 1 },
                { icon: ChevronsRight, to: pageCount - 1, dis: current >= pageCount - 1 },
              ].map(({ icon: Icon, to, dis }, i) => (
                <button key={i} onClick={() => goTo(to)} disabled={dis}
                  className="w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-40 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && <NewPaymentModal memberships={memberships} connectedProviders={connectedProviders} onClose={() => setModalOpen(false)} />}
    </>
  )
}
