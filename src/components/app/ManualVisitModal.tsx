"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "@/lib/use-action"
import {
  X, Search, CheckCircle2, AlertTriangle, AlertCircle,
  Calendar, Clock, ChevronDown, UserX, UserPlus,
  TrendingUp, CreditCard, Wallet, Timer,
} from "lucide-react"
import {
  searchClientsManualAction,
  manualVisitAction,
  type ManualClientResult,
  type ManualClientSub,
} from "@/app/(app)/visits/actions"

// ── helpers ──────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }
function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("T")[0].split("-")
  return `${d}.${m}.${y}`
}
function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}
function fmtLastVisit(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (diff === 0) return "сегодня в " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  if (diff === 1) return "вчера"
  if (diff < 7) return `${diff} дня назад`
  return fmtDate(iso)
}

const VISIT_TYPES = [
  "Обычное",
  "Тренировка",
  "Гостевой визит",
  "Пробное занятие",
  "Персональная тренировка",
]

// ── styled primitives ─────────────────────────────────────────────

const S = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }

function FInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...p}
      className="h-10 w-full rounded-lg px-3 text-sm outline-none"
      style={S}
    />
  )
}
function FSelect({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div className="relative">
      <select {...p} className="h-10 w-full rounded-lg px-3 text-sm outline-none appearance-none pr-8" style={S}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
    </div>
  )
}

// ── sub status helpers ────────────────────────────────────────────

function subStatus(sub: ManualClientSub): { color: string; bg: string; dot: string; label: string; canVisit: boolean; reason?: string } {
  if (sub.status === "frozen") return { color: "#2563eb", bg: "rgba(37,99,235,0.08)", dot: "#2563eb", label: "Заморожен", canVisit: false, reason: "Абонемент заморожен" }
  if (sub.status === "expired") return { color: "#dc2626", bg: "rgba(220,38,38,0.08)", dot: "#dc2626", label: "Истёк", canVisit: false, reason: `Абонемент истёк ${fmtDate(sub.expiresAt)}` }
  if (sub.visitsLeft !== null && sub.visitsLeft <= 0) return { color: "#dc2626", bg: "rgba(220,38,38,0.08)", dot: "#dc2626", label: "Лимит исчерпан", canVisit: false, reason: "Лимит посещений исчерпан" }
  if (sub.daysLeft !== null && sub.daysLeft <= 2) return { color: "#d97706", bg: "rgba(217,119,6,0.08)", dot: "#d97706", label: `Заканчивается через ${sub.daysLeft} дн.`, canVisit: true }
  return { color: "#16a34a", bg: "rgba(22,163,74,0.08)", dot: "#16a34a", label: "Активен", canVisit: true }
}

// ── ClientCard ────────────────────────────────────────────────────

function ClientCard({
  client,
  selectedSubId,
  onSelectSub,
}: {
  client: ManualClientResult
  selectedSubId: string | null
  onSelectSub: (id: string | null) => void
}) {
  const initials = client.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
  const activeSubs = client.subscriptions.filter((s) => s.status === "active")
  const allSubs = client.subscriptions

  const currentSub = allSubs.find((s) => s.id === selectedSubId) ?? allSubs.find((s) => s.status === "active") ?? allSubs[0] ?? null
  const st = currentSub ? subStatus(currentSub) : null

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
      {/* Profile row */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--on-dark)" }}>{client.name}</p>
          {client.phone && <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{client.phone}</p>}
        </div>
        {client.visitedToday && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(217,119,6,0.12)", color: "#d97706" }}>
            Уже сегодня
          </span>
        )}
      </div>

      {/* Subscription selection if multiple active */}
      {activeSubs.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium" style={{ color: "var(--gray-muted)" }}>Выберите абонемент</p>
          {activeSubs.map((s) => (
            <label key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              style={{ border: selectedSubId === s.id ? "1.5px solid #2563eb" : "1.5px solid var(--border)" }}>
              <input type="radio" name="sub" className="accent-blue-600"
                checked={selectedSubId === s.id}
                onChange={() => onSelectSub(s.id)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{s.membershipName}</span>
              </div>
              <span className="text-xs" style={{ color: subStatus(s).color }}>{subStatus(s).label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Status banner */}
      {currentSub && st && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
          style={{ background: st.bg, border: `1px solid ${st.dot}25` }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: st.dot }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: st.color }}>{st.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
              {currentSub.membershipName}
              {currentSub.expiresAt && ` · Истекает ${fmtDate(currentSub.expiresAt)}`}
            </p>
          </div>
        </div>
      )}

      {!currentSub && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
          <p className="text-xs font-medium" style={{ color: "#dc2626" }}>Нет активного абонемента</p>
        </div>
      )}

      {/* Debt */}
      {client.debt > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#d97706" }} />
          <p className="text-xs font-medium" style={{ color: "#d97706" }}>
            Долг: {client.debt.toLocaleString("ru-RU")} сум
          </p>
        </div>
      )}
    </div>
  )
}

// ── Right-side preview ────────────────────────────────────────────

function PreviewPanel({ client, selectedSubId }: { client: ManualClientResult | null; selectedSubId: string | null }) {
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--card-2)" }}>
          <Search className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />
        </div>
        <p className="text-sm text-center" style={{ color: "var(--gray-muted)" }}>
          Найдите клиента,<br />чтобы увидеть статус
        </p>
      </div>
    )
  }

  const sub = client.subscriptions.find((s) => s.id === selectedSubId)
    ?? client.subscriptions.find((s) => s.status === "active")
    ?? client.subscriptions[0]
    ?? null
  const st = sub ? subStatus(sub) : null
  const initials = client.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {initials}
        </div>
        <div>
          <p className="font-semibold" style={{ color: "var(--on-dark)" }}>{client.name}</p>
          <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{client.phone ?? "—"}</p>
        </div>
      </div>

      {/* Stats grid */}
      {[
        {
          icon: TrendingUp,
          label: "Статус абонемента",
          value: st?.label ?? "Нет абонемента",
          valueColor: st?.color ?? "#dc2626",
        },
        {
          icon: Calendar,
          label: "Дата окончания",
          value: sub ? fmtDate(sub.expiresAt) : "—",
          valueColor: "var(--on-dark)",
        },
        {
          icon: CreditCard,
          label: "Осталось посещений",
          value: sub
            ? sub.visitsLeft === null ? "∞" : `${sub.visitsLeft} из ${sub.visitsTotal}`
            : "—",
          valueColor: "var(--on-dark)",
        },
        {
          icon: Wallet,
          label: "Долг",
          value: client.debt > 0 ? `${client.debt.toLocaleString("ru-RU")} сум` : "0 сум",
          valueColor: client.debt > 0 ? "#d97706" : "#16a34a",
        },
        {
          icon: Timer,
          label: "Последнее посещение",
          value: fmtLastVisit(client.lastVisitAt) ?? "Нет данных",
          valueColor: "var(--on-dark)",
        },
      ].map(({ icon: Icon, label, value, valueColor }) => (
        <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--card-2)", border: "1px solid var(--border-subtle)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--card)" }}>
            <Icon className="w-4 h-4" style={{ color: "var(--gray-muted)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{label}</p>
            <p className="text-sm font-semibold" style={{ color: valueColor }}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────

type Props = { role: string }

export function ManualVisitModal({ role }: Props) {
  const [open, setOpen] = useState(false)

  // Search
  const [query,   setQuery]   = useState("")
  const [results, setResults] = useState<ManualClientResult[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const debRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selection
  const [client,   setClient]   = useState<ManualClientResult | null>(null)
  const [subId,    setSubId]    = useState<string | null>(null)

  // Form
  const canChangeDate = ["owner", "admin"].includes(role)
  const [date,    setDate]    = useState(today())
  const [time,    setTime]    = useState(nowTime())
  const [vType,   setVType]   = useState("Обычное")
  const [comment, setComment] = useState("")

  // Submit state
  const [pending,   start]      = useTransition()
  const [error,     setError]   = useState<string | null>(null)
  const [warning,   setWarning] = useState<string | null>(null)
  const [success,   setSuccess] = useState(false)
  const [duplicate, setDuplicate] = useState<string | null>(null)

  // Keyboard shortcut
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === "Escape") { closeModal() }
    }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [open])

  // Search debounce
  const doSearch = useCallback((q: string) => {
    if (debRef.current) clearTimeout(debRef.current)
    if (q.trim().length < 1) { setResults([]); setDropOpen(false); return }
    setSearching(true)
    debRef.current = setTimeout(async () => {
      const res = await searchClientsManualAction(q)
      setResults(res); setDropOpen(res.length > 0); setSearching(false)
    }, 200)
  }, [])

  useEffect(() => { doSearch(query) }, [query, doSearch])

  // Click outside dropdown
  useEffect(() => {
    if (!dropOpen) return
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [dropOpen])

  function selectClient(c: ManualClientResult) {
    setClient(c)
    setDropOpen(false)
    setQuery("")
    // pick best sub
    const active = c.subscriptions.find((s) => s.status === "active")
    setSubId(active?.id ?? c.subscriptions[0]?.id ?? null)
    setError(null)
    setDuplicate(null)
  }

  function resetClient() {
    setClient(null); setSubId(null); setError(null); setDuplicate(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function closeModal() {
    setOpen(false)
    setTimeout(() => {
      setClient(null); setSubId(null); setQuery(""); setResults([])
      setError(null); setWarning(null); setSuccess(false); setDuplicate(null)
      setDate(today()); setTime(nowTime()); setVType("Обычное"); setComment("")
    }, 300)
  }

  // Determine block reason
  const currentSub = client?.subscriptions.find((s) => s.id === subId) ?? null
  const st = currentSub ? subStatus(currentSub) : null
  const blocked = !!(st && !st.canVisit)
  const blockReason = st?.reason ?? null

  function submit(force = false) {
    if (!client) { setError("Выберите клиента"); return }
    if (blocked && !force) return
    setError(null); setDuplicate(null)
    const checkedInAt = `${date}T${time}:00`
    start(async () => {
      const res = await manualVisitAction({
        clientId:     client.id,
        subscriptionId: subId,
        checkedInAt,
        visitType:    vType,
        comment,
        force,
      })
      if (res.error === "duplicate") {
        setDuplicate(res.duplicateAt ?? null)
        return
      }
      if (res.error) { setError(res.error); toast.error(res.error); return }
      if (res.warning) { setWarning(res.warning); toast.warning(res.warning) }
      else toast.success("Посещение отмечено")
      setSuccess(true)
      setTimeout(closeModal, 1600)
    })
  }

  const canVisit = !!client && !blocked

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 text-white transition-opacity hover:opacity-90 flex-shrink-0"
        style={{ background: "#2563eb" }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }}>+</span>
        Отметить вручную
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] flex justify-end">
          {/* Backdrop — стандарт как в «Клиентах» */}
          <div className="absolute inset-0" style={{ background: "rgba(2,6,23,0.4)" }}
            onClick={closeModal} />

          {/* Drawer — стандарт: var(--card), левый бордер, мягкая тень */}
          <div className="relative w-full max-w-[560px] h-full flex flex-col overflow-hidden"
            style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>

            {/* ── Form (vertical) ── */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--on-dark)", letterSpacing: "-0.12px" }}>
                    Новое посещение
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
                    Выберите клиента и зарегистрируйте посещение
                  </p>
                </div>
                <button onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 mt-0.5"
                  style={{ color: "var(--on-dark-soft)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">

                {/* Search */}
                {!client ? (
                  <div className="relative" ref={searchRef}>
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
                    {searching && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "#2563eb" }} />
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Введите имя, телефон или номер карты..."
                      className="h-12 w-full rounded-xl text-sm outline-none"
                      style={{ ...S, paddingLeft: 40, paddingRight: 40, fontSize: 14 }}
                      onFocus={() => { if (results.length) setDropOpen(true) }}
                    />
                    {dropOpen && (
                      <div className="absolute left-0 right-0 top-[52px] z-50 rounded-xl overflow-hidden"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
                        {results.map((r) => {
                          const activeSub = r.subscriptions.find((s) => s.status === "active") ?? r.subscriptions[0] ?? null
                          const st2 = activeSub ? subStatus(activeSub) : null
                          const ini = r.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
                          return (
                            <button key={r.id} type="button" onClick={() => selectClient(r)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                                {ini}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{r.name}</p>
                                <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                                  {r.phone ?? "—"}
                                  {activeSub && ` · ${activeSub.membershipName}`}
                                </p>
                              </div>
                              {st2 && (
                                <span className="text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
                                  style={{ background: st2.bg, color: st2.color }}>
                                  {st2.label}
                                </span>
                              )}
                              {r.visitedToday && (
                                <span className="text-xs flex-shrink-0" style={{ color: "#d97706" }}>⚠</span>
                              )}
                            </button>
                          )
                        })}
                        {results.length === 0 && (
                          <div className="flex flex-col items-center gap-2 py-6">
                            <UserX className="w-6 h-6" style={{ color: "var(--gray-muted)" }} />
                            <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Клиент не найден</p>
                            <button className="text-xs font-medium flex items-center gap-1" style={{ color: "#2563eb" }}>
                              <UserPlus className="w-3.5 h-3.5" />Создать нового
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ClientCard client={client} selectedSubId={subId} onSelectSub={setSubId} />
                    <button onClick={resetClient}
                      className="text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
                      style={{ color: "var(--gray-muted)" }}>
                      <X className="w-3 h-3" />Выбрать другого клиента
                    </button>
                  </div>
                )}

                {/* Duplicate warning */}
                {duplicate && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)" }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#d97706" }} />
                      <p className="text-sm font-semibold" style={{ color: "#d97706" }}>
                        Клиент уже зарегистрирован сегодня
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                      Время входа: {fmtDatetime(duplicate)}
                    </p>
                    <button
                      onClick={() => submit(true)}
                      disabled={pending}
                      className="w-full h-9 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: "rgba(217,119,6,0.15)", color: "#d97706", border: "1px solid rgba(217,119,6,0.3)" }}>
                      {pending ? "Регистрация..." : "Всё равно зарегистрировать"}
                    </button>
                  </div>
                )}

                {/* Block reason */}
                {blocked && blockReason && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
                    <p className="text-sm font-medium" style={{ color: "#dc2626" }}>{blockReason}</p>
                  </div>
                )}

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  {canChangeDate ? (
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Дата</p>
                      <div className="relative">
                        <FInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Дата</p>
                      <div className="h-10 flex items-center px-3 rounded-lg text-sm"
                        style={{ background: "var(--card-2)", color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}>
                        {fmtDate(date + "T00:00:00")}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Время</p>
                    <div className="relative">
                      <FInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
                    </div>
                  </div>
                </div>

                {/* Visit type */}
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Тип посещения</p>
                  <FSelect value={vType} onChange={(e) => setVType(e.target.value)}>
                    {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </FSelect>
                </div>

                {/* Comment */}
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Комментарий <span style={{ color: "var(--gray-muted)" }}>(необязательно)</span></p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Забыл карту, попросил отметить вручную..."
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                    style={S}
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm font-medium" style={{ color: "#dc2626" }}>{error}</p>
                )}

                {/* Success */}
                {success && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>Посещение зарегистрировано</p>
                      {warning && <p className="text-xs mt-0.5" style={{ color: "#d97706" }}>⚠ {warning}</p>}
                    </div>
                  </div>
                )}

                {/* ── Предпросмотр (снизу) ── */}
                {client && (
                  <div className="pt-4 mt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--gray-muted)" }}>
                      Предпросмотр
                    </p>
                    <PreviewPanel client={client} selectedSubId={subId} />
                  </div>
                )}
              </div>

              {/* Footer */}
              {!success && (
                <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <button onClick={closeModal}
                    className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    style={{ color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}>
                    Отмена
                  </button>
                  <button
                    onClick={() => submit(false)}
                    disabled={pending || !canVisit || !!duplicate}
                    className="flex-1 h-10 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: "#2563eb" }}>
                    {pending ? "Регистрация..." : "Зарегистрировать посещение"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
