"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { X, Search, CheckCircle2, ChevronDown } from "lucide-react"
import { searchClientsPayments, createPaymentAction } from "@/app/(app)/payments/actions"
import type { ClientSearchResult } from "@/lib/visits"

type Membership = { id: string; name: string; price: number }
type Provider = "cash" | "click" | "payme" | "uzum"

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "cash",  label: "Наличные" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "uzum",  label: "Uzum" },
]

export function NewPaymentModal({ memberships, onClose }: {
  memberships: Membership[]
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [client, setClient] = useState<ClientSearchResult | null>(null)
  const [membershipId, setMembershipId] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [provider, setProvider] = useState<Provider>("cash")
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, start] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSearchResults([]); setSearchOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await searchClientsPayments(q)
      setSearchResults(res)
      setSearchOpen(true)
    }, 220)
  }, [])

  useEffect(() => { if (!client) search(query) }, [query, client, search])

  useEffect(() => {
    if (!searchOpen) return
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [searchOpen])

  function selectMembership(id: string | null) {
    setMembershipId(id)
    if (id) {
      const m = memberships.find((m) => m.id === id)
      if (m) setAmount(String(m.price))
    }
  }

  function handleSubmit() {
    if (!client) { setError("Выберите клиента"); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError("Введите сумму"); return }
    setError(null)
    start(async () => {
      const res = await createPaymentAction({
        clientId: client.id,
        membershipId,
        amount: Number(amount),
        provider,
        comment,
      })
      if (res.error) { setError(res.error); return }
      setSuccess(true)
      setTimeout(onClose, 1200)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: "var(--card)", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Новая оплата</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
            <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Оплата сохранена!</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Client search */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Клиент</label>
              {client ? (
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ border: "1.5px solid #2563eb" }}
                  onClick={() => { setClient(null); setQuery("") }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: "#2563eb" }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{client.name}</p>
                    {client.phone && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{client.phone}</p>}
                  </div>
                  <X className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gray-muted)" }} />
                </div>
              ) : (
                <div className="relative" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Имя или телефон..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none"
                    style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
                    onFocus={() => { if (searchResults.length) setSearchOpen(true) }}
                  />
                  {searchOpen && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-11 z-50 rounded-lg py-1 overflow-hidden"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                      {searchResults.map((r) => (
                        <button key={r.id} onClick={() => { setClient(r); setSearchOpen(false); setQuery("") }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: "#3b82f6" }}>
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{r.name}</p>
                            {r.phone && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{r.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Membership */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Абонемент (необязательно)</label>
              <div className="relative">
                <select
                  value={membershipId ?? ""}
                  onChange={(e) => selectMembership(e.target.value || null)}
                  className="w-full h-10 pl-3 pr-8 rounded-lg text-sm appearance-none outline-none"
                  style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}
                >
                  <option value="">— Без абонемента —</option>
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.price.toLocaleString("ru-RU")} сум</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Сумма (сум)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
              />
            </div>

            {/* Provider */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--on-dark-soft)" }}>Способ оплаты</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setProvider(p.value)}
                    className="h-9 rounded-lg text-sm font-medium transition-all"
                    style={{
                      border: provider === p.value ? "1.5px solid #2563eb" : "1.5px solid var(--border)",
                      background: provider === p.value ? "rgba(37,99,235,0.12)" : "var(--card)",
                      color: provider === p.value ? "#2563eb" : "var(--on-dark-soft)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Комментарий</label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Необязательно"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
            )}
          </div>
        )}

        {!success && (
          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="w-full h-10 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#2563eb" }}
            >
              {pending ? "Сохранение..." : "Сохранить оплату"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
