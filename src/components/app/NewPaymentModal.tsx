"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { X, Search, CheckCircle2, ChevronDown, Copy, Send, QrCode } from "lucide-react"
import { toast } from "@/lib/use-action"
import { searchClientsPayments, createPaymentAction, createOnlinePaymentAction, sendPaymentLinkTelegramAction, getPaymentStatusAction, getPaymentMethodsAction, type OnlinePaymentResult } from "@/app/(app)/payments/actions"
import type { PayMethod } from "@/lib/payment-methods"
import type { ClientSearchResult } from "@/lib/visits"
import { MoneyInput } from "./MoneyInput"

type Membership = { id: string; name: string; price: number }
type Provider = "cash" | "click" | "payme" | "uzum"

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "cash",  label: "Наличные" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "uzum",  label: "Uzum" },
]

export function NewPaymentModal({ memberships, connectedProviders = [], onClose }: {
  memberships: Membership[]
  connectedProviders?: string[]
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
  const [online, setOnline] = useState(false)
  const [link, setLink] = useState<OnlinePaymentResult | null>(null)
  const [paidLive, setPaidLive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tgSent, setTgSent] = useState<string | null>(null)
  const [methods, setMethods] = useState<PayMethod[]>([])

  // Доступные методы оплаты (настройки клуба + интеграция).
  useEffect(() => {
    getPaymentMethodsAction().then((m) => {
      setMethods(m)
      const first = m.find((x) => x.available)
      if (first) setProvider(first.key as Provider)
    }).catch(() => {})
  }, [])

  // Авто-обновление статуса: пока показан QR — опрашиваем платёж каждые 3 c.
  useEffect(() => {
    if (!link?.paymentId || paidLive) return
    const t = setInterval(async () => {
      const r = await getPaymentStatusAction(link.paymentId!)
      if (r.status === "paid") { setPaidLive(true); clearInterval(t) }
    }, 3000)
    return () => clearInterval(t)
  }, [link, paidLive])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, start] = useTransition()

  // Онлайн доступен только для подключённых click/payme.
  const onlineCapable = (provider === "click" || provider === "payme") && connectedProviders.includes(provider)
  function pickProvider(p: Provider) {
    setProvider(p)
    setOnline((p === "click" || p === "payme") && connectedProviders.includes(p))
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 1) { setSearchResults([]); setSearchOpen(false); return }
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
      if (online && (provider === "click" || provider === "payme")) {
        const res = await createOnlinePaymentAction({ clientId: client.id, membershipId, amount: Number(amount), provider })
        if (res.error) { setError(res.error); toast.error(res.error); return }
        setLink(res)   // показываем экран со ссылкой + QR
        toast.success("Ссылка на оплату создана")
        return
      }
      const res = await createPaymentAction({ clientId: client.id, membershipId, amount: Number(amount), provider, comment })
      if (res.error) { setError(res.error); toast.error(res.error); return }
      setSuccess(true)
      toast.success("Оплата добавлена")
      setTimeout(onClose, 1200)
    })
  }

  function copyLink() {
    if (!link?.url) return
    navigator.clipboard?.writeText(link.url)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  function sendTelegram() {
    if (!client || !link?.url) return
    start(async () => {
      const r = await sendPaymentLinkTelegramAction(client.id, link.url!)
      setTgSent(r.error ? `Ошибка: ${r.error}` : "Отправлено в Telegram ✓")
    })
  }

  return (
    <div className="fixed inset-0 z-50" style={{ background: "rgba(2,6,23,0.4)" }}>
      {/* backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer */}
      <div
        className="absolute top-0 right-0 bottom-0 w-full max-w-[480px] flex flex-col"
        style={{
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2
            className="text-2xl font-semibold tracking-[-0.144px]"
            style={{ color: "var(--on-dark)" }}
          >
            Новая оплата
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ color: "var(--on-dark-soft)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {link && paidLive ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
            <CheckCircle2 className="w-14 h-14" style={{ color: "#16a34a" }} />
            <p className="text-base font-semibold" style={{ color: "#16a34a" }}>Оплата получена!</p>
            <p className="text-sm text-center" style={{ color: "var(--on-dark-soft)" }}>Платёж проведён через {provider === "click" ? "Click" : "Payme"}. Абонемент активирован.</p>
            <button onClick={onClose} className="mt-2 h-10 px-5 rounded-lg text-sm font-medium text-white" style={{ background: "#16a34a" }}>Готово</button>
          </div>
        ) : link ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-6 gap-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: "#d97706" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#d97706" }} />
              Ожидаем оплату — статус обновится автоматически
            </div>
            {link.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.qr} alt="QR" className="rounded-xl" style={{ width: 220, height: 220, border: "1px solid var(--border)" }} />
            )}
            <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--card-2)" }}>
              <span className="text-xs flex-1 truncate" style={{ color: "#2563eb" }}>{link.url}</span>
              <button onClick={copyLink} className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: copied ? "#16a34a" : "var(--on-dark-soft)" }} title="Копировать">
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <a href={link.url} target="_blank" rel="noreferrer" className="w-full h-11 rounded-lg flex items-center justify-center text-sm font-medium text-white" style={{ background: "#2563eb" }}>
              Открыть страницу оплаты
            </a>
            {link.hasTelegram && (
              <button onClick={sendTelegram} disabled={pending} className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50" style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)" }}>
                <Send className="w-4 h-4" style={{ color: "#2AABEE" }} /> {pending ? "Отправка..." : "Отправить клиенту в Telegram"}
              </button>
            )}
            {tgSent && <p className="text-xs" style={{ color: tgSent.startsWith("Ошибка") ? "#dc2626" : "#16a34a" }}>{tgSent}</p>}
            <button onClick={onClose} className="w-full h-10 rounded-lg text-sm font-medium mt-auto" style={{ color: "var(--on-dark-soft)" }}>Готово</button>
          </div>
        ) : success ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
            <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Оплата сохранена!</p>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Client search */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>
                  Клиент
                </label>
                {client ? (
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ border: "1.5px solid #2563eb" }}
                    onClick={() => { setClient(null); setQuery("") }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ background: "#2563eb" }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{client.name}</p>
                      {client.phone && <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{client.phone}</p>}
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
                      <div
                        className="absolute left-0 right-0 top-11 z-50 rounded-lg py-1 overflow-hidden"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                      >
                        {searchResults.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => { setClient(r); setSearchOpen(false); setQuery("") }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors"
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                              style={{ background: "#2563eb" }}
                            >
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{r.name}</p>
                              {r.phone && <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{r.phone}</p>}
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
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>
                  Абонемент <span style={{ color: "var(--gray-muted)", fontWeight: 400 }}>(необязательно)</span>
                </label>
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
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>
                  Сумма
                </label>
                <MoneyInput
                  value={amount}
                  onChange={(n) => setAmount(String(n))}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
                  suffixColor="var(--gray-muted)"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-dark)" }}>
                  Способ оплаты
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(methods.length ? methods : PROVIDERS.map((p) => ({ key: p.value, label: p.label, available: true, online: p.value === "click" || p.value === "payme" }))).map((m) => {
                    const key = m.key as Provider
                    const canOnline = m.online && m.available
                    const selected = provider === key
                    return (
                      <button
                        key={key}
                        onClick={() => m.available && pickProvider(key)}
                        disabled={!m.available}
                        title={m.available ? undefined : "не подключён"}
                        className="h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                        style={{
                          border: selected ? "1.5px solid #2563eb" : "1.5px solid var(--border)",
                          background: selected ? "rgba(37,99,235,0.06)" : "var(--card)",
                          color: selected ? "#2563eb" : "var(--on-dark-soft)",
                        }}
                      >
                        {m.label}
                        {canOnline && <span className="text-[9px] font-semibold px-1 rounded" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>online</span>}
                        {m.online && !m.available && <span className="text-[9px] font-medium px-1 rounded" style={{ background: "rgba(148,163,184,0.15)", color: "var(--gray-muted)" }}>не подкл.</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Онлайн-оплата: ссылка/QR клиенту */}
                {onlineCapable && (
                  <button onClick={() => setOnline((v) => !v)}
                    className="mt-2 w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg transition-colors"
                    style={{ border: "1.5px solid", borderColor: online ? "#2563eb" : "var(--border)", background: online ? "rgba(37,99,235,0.04)" : "var(--card)" }}>
                    <span className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark)" }}>
                      <QrCode className="w-4 h-4" style={{ color: online ? "#2563eb" : "var(--gray-muted)" }} />
                      Онлайн-оплата (ссылка + QR клиенту)
                    </span>
                    <span className="w-9 h-5 rounded-full relative transition-colors shrink-0" style={{ background: online ? "#2563eb" : "var(--border)" }}>
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: online ? "18px" : "2px" }} />
                    </span>
                  </button>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>
                  Комментарий <span style={{ color: "var(--gray-muted)", fontWeight: 400 }}>(необязательно)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Необязательно"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 shrink-0"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="w-full h-11 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--on-dark)", color: "var(--bg)" }}
              >
                {pending ? "..." : online ? "Сформировать ссылку" : "Сохранить оплату"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
