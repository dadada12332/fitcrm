"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Search, CheckCircle2, AlertCircle, AlertTriangle, Clock, X } from "lucide-react"
import { searchClientsAction, markVisitAction } from "@/app/(app)/visits/actions"
import type { ClientSearchResult } from "@/lib/visits"

type Toast = { type: "ok" | "warn" | "err"; text: string; clientName?: string }

function SubBadge({ result }: { result: ClientSearchResult }) {
  if (!result.subscriptionStatus || result.subscriptionStatus === "cancelled") {
    return <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card-2)", color: "var(--gray-muted)" }}>Нет абонемента</span>
  }
  if (result.subscriptionStatus === "expired" || (result.daysLeft !== null && result.daysLeft < 0)) {
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(220,38,38,0.14)", color: "#dc2626" }}>Истёк</span>
  }
  if (result.visitsLeft !== null && result.visitsLeft <= 3) {
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(217,119,6,0.14)", color: "#d97706" }}>Осталось {result.visitsLeft} посещений</span>
  }
  if (result.daysLeft !== null && result.daysLeft <= 5) {
    return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(217,119,6,0.14)", color: "#d97706" }}>Истекает через {result.daysLeft} дн.</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>Активен</span>
}

export function VisitsQuickCheckin() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [marking, startMark] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await searchClientsAction(q)
      setResults(res)
      setOpen(true)
      setLoading(false)
    }, 220)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function showToast(t: Toast) {
    setToast(t)
    setTimeout(() => setToast(null), 3500)
  }

  function handleMark(client: ClientSearchResult) {
    if (client.subscriptionStatus === "expired") {
      showToast({ type: "err", text: "Абонемент истёк — сначала продлите", clientName: client.name })
      setOpen(false)
      return
    }
    startMark(async () => {
      const res = await markVisitAction(client.id, client.subscriptionId)
      setOpen(false)
      setQuery("")
      setResults([])
      if (res.error) {
        showToast({ type: "err", text: res.error, clientName: client.name })
      } else if (res.warning) {
        showToast({ type: "warn", text: `Посещение отмечено. ⚠ ${res.warning}`, clientName: client.name })
      } else {
        showToast({ type: "ok", text: "Посещение отмечено", clientName: client.name })
      }
      inputRef.current?.focus()
    })
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: loading ? "#3b82f6" : "var(--gray-muted)" }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true) }}
          placeholder="Поиск клиента по имени или телефону..."
          autoComplete="off"
          className="w-full h-12 pl-12 pr-10 rounded-xl text-sm outline-none transition-shadow"
          style={{
            background: "var(--card)",
            border: "1.5px solid var(--border)",
            color: "var(--on-dark)",
            boxShadow: open ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
            borderColor: open ? "#3b82f6" : "var(--border)",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" style={{ color: "var(--gray-muted)" }} />
          </button>
        )}
      </div>

      {/* Результаты — карточками */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {results.map((client) => {
            const expired = client.subscriptionStatus === "expired" || (client.daysLeft !== null && client.daysLeft < 0)
            return (
              <div key={client.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold text-white" style={{ background: "#3b82f6" }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: "var(--on-dark)" }}>{client.name}</span>
                      {client.visitedToday && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>Уже был</span>
                      )}
                    </div>
                    {client.phone && <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{client.phone}</p>}
                    {client.membershipName && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{client.membershipName}</p>}
                  </div>
                </div>
                <div><SubBadge result={client} /></div>
                <button
                  onClick={() => handleMark(client)}
                  disabled={marking || expired}
                  className="h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed mt-auto"
                  style={{ background: expired ? "var(--gray-muted)" : "#16a34a" }}
                >
                  <CheckCircle2 className="w-4 h-4" /> {expired ? "Абонемент истёк" : "Отметить"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="mt-4 rounded-xl px-4 py-8 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--gray-muted)" }}>
          Клиент не найден
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="absolute left-0 right-0 top-14 z-50 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: toast.type === "ok" ? "rgba(22,163,74,0.1)" : toast.type === "warn" ? "#fffbeb" : "rgba(220,38,38,0.1)",
            border: `1px solid ${toast.type === "ok" ? "rgba(22,163,74,0.3)" : toast.type === "warn" ? "#fde68a" : "rgba(220,38,38,0.3)"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
        >
          {toast.type === "ok" && <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#16a34a" }} />}
          {toast.type === "warn" && <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} />}
          {toast.type === "err" && <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#dc2626" }} />}
          <div>
            {toast.clientName && (
              <p className="text-xs font-medium" style={{ color: toast.type === "ok" ? "#16a34a" : toast.type === "warn" ? "#d97706" : "#dc2626" }}>
                {toast.clientName}
              </p>
            )}
            <p className="text-sm" style={{ color: toast.type === "ok" ? "#166534" : toast.type === "warn" ? "#92400e" : "#991b1b" }}>
              {toast.text}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
