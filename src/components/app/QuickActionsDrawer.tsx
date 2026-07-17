"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  X,
  Search, CheckCircle2, AlertCircle, AlertTriangle,
  ChevronDown, Calendar,
} from "lucide-react"
import {
  getMembershipsForDrawer,
  type QuickMembership,
} from "@/app/(app)/actions"
import { createClientAction } from "@/app/(app)/clients/actions"
import { createPaymentAction, searchClientsPayments, getPaymentMethodsAction } from "@/app/(app)/payments/actions"
import type { PayMethod } from "@/lib/payment-methods"
import { searchClientsAction, markVisitAction } from "@/app/(app)/visits/actions"
import { addStaffAction } from "@/app/(app)/staff/actions"
import { createMembershipAction } from "@/app/(app)/memberships/actions"
import type { ClientSearchResult } from "@/lib/visits"
import { MoneyInput } from "./MoneyInput"

// ── Shared primitives ────────────────────────────────────────────────

const INP = "h-10 w-full rounded-md text-sm outline-none px-3"
const INP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
      {children}{required && <span style={{ color: "#ef4444" }}> *</span>}
    </p>
  )
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INP} style={INP_STYLE} />
}

function FMoney({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <MoneyInput value={value} onChange={(n) => onChange(String(n))} placeholder={placeholder} className={INP} style={INP_STYLE} />
}

function FSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div className="relative">
      <select {...props} className={`${INP} appearance-none pr-8`} style={INP_STYLE}>{children}</select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
    </div>
  )
}

function FSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{label}</p>
      {children}
    </div>
  )
}

function FSep() {
  return <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
}

function ErrMsg({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-sm" style={{ color: "#dc2626" }}>{msg}</p>
}

function SubmitBtn({ pending, label, pendingLabel = "Сохранение..." }: { pending: boolean; label: string; pendingLabel?: string }) {
  return (
    <button type="submit" disabled={pending}
      className="w-full h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "#2563eb" }}>
      {pending ? pendingLabel : label}
    </button>
  )
}

// ── Phone mask ───────────────────────────────────────────────────────

function phoneDigits(v: string) {
  const d = v.replace(/\D/g, "")
  return d.startsWith("998") ? d.slice(3).slice(0, 9) : d.slice(0, 9)
}
function displayPhone(d: string) {
  if (!d) return ""
  if (d.length <= 2) return `+998 (${d}`
  if (d.length <= 5) return `+998 (${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 7) return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5)}`
  return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`
}
function dateDigits(v: string) { return v.replace(/\D/g, "").slice(0, 8) }
function displayDate(d: string) {
  if (!d) return ""
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}
function rawDateISO(d: string) {
  if (d.length !== 8) return ""
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

// ── Type ─────────────────────────────────────────────────────────────

export type QuickActionView = "client" | "payment" | "membership" | "visit" | "staff"

// ── View: New client ─────────────────────────────────────────────────

function NewClientView({ memberships, onDone }: { memberships: QuickMembership[]; onDone: () => void }) {
  const [firstName, setFirstName] = useState("")
  const [lastName,  setLastName]  = useState("")
  const [phoneDig,  setPhoneDig]  = useState("")
  const [dateDig,   setDateDig]   = useState("")
  const [gender,    setGender]    = useState("")
  const [email,     setEmail]     = useState("")
  const [membershipId, setMembershipId] = useState("")
  const [source,    setSource]    = useState("")
  const [notes,     setNotes]     = useState("")
  const [error,     setError]     = useState<string | null>(null)
  const [ok,        setOk]        = useState(false)
  const [pending,   start]        = useTransition()

  const SINGLE = { id: "single", name: "Разовый (1 занятие)", price: 0 }
  const allMemberships = [SINGLE, ...memberships]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) { setError("Введите имя"); return }
    if (phoneDig.length !== 9) { setError("Введите корректный номер телефона"); return }
    setError(null)
    const fd = new FormData()
    fd.set("first_name", firstName.trim())
    fd.set("last_name", lastName.trim())
    fd.set("phone", `+998${phoneDig}`)
    fd.set("birth_date", rawDateISO(dateDig))
    fd.set("gender", gender)
    fd.set("email", email.trim())
    fd.set("membership_id", membershipId)
    fd.set("source", source)
    fd.set("notes", notes.trim())
    start(async () => {
      const res = await createClientAction({}, fd)
      if (res.error) { setError(res.error); return }
      setOk(true)
      setTimeout(onDone, 1000)
    })
  }

  if (ok) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
      <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Клиент добавлен!</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FSection label="Личные данные">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FLabel required>Имя</FLabel>
            <FInput autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Азиз" />
          </div>
          <div>
            <FLabel>Фамилия</FLabel>
            <FInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Каримов" />
          </div>
        </div>
        <div>
          <FLabel required>Телефон</FLabel>
          <FInput
            value={displayPhone(phoneDig)}
            onChange={(e) => setPhoneDig(phoneDigits(e.target.value))}
            placeholder="+998 (90) 000-00-00"
            inputMode="numeric"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FLabel>Дата рождения</FLabel>
            <div className="relative">
              <FInput
                value={displayDate(dateDig)}
                onChange={(e) => setDateDig(dateDigits(e.target.value))}
                placeholder="дд.мм.гггг"
                inputMode="numeric"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
            </div>
          </div>
          <div>
            <FLabel>Пол</FLabel>
            <FSelect value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Выберите</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </FSelect>
          </div>
        </div>
        <div>
          <FLabel>E-mail</FLabel>
          <FInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aziz@gmail.com" />
        </div>
      </FSection>

      <FSep />

      <FSection label="Абонемент">
        <div>
          <FLabel>Абонемент</FLabel>
          <FSelect value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
            <option value="">Выберите абонемент</option>
            {allMemberships.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.price > 0 ? ` — ${m.price.toLocaleString("ru-RU")} сум` : ""}
              </option>
            ))}
          </FSelect>
        </div>
        <div>
          <FLabel>Источник</FLabel>
          <FSelect value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Откуда узнал</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook / VK</option>
            <option value="referral">Рекомендация</option>
            <option value="outdoor">Наружная реклама</option>
            <option value="other">Другое</option>
          </FSelect>
        </div>
        <div>
          <FLabel>Комментарий</FLabel>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Необязательно..." rows={3}
            className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
            style={INP_STYLE}
          />
        </div>
      </FSection>

      <ErrMsg msg={error} />
      <SubmitBtn pending={pending} label="Добавить клиента" pendingLabel="Добавление..." />
    </form>
  )
}

// ── View: New payment ────────────────────────────────────────────────

type PayProvider = "cash" | "click" | "payme" | "uzum"
const PROVIDERS: { value: PayProvider; label: string }[] = [
  { value: "cash",  label: "Наличные" },
  { value: "click", label: "Click"    },
  { value: "payme", label: "Payme"    },
  { value: "uzum",  label: "Uzum"     },
]

function NewPaymentView({ memberships, onDone }: { memberships: QuickMembership[]; onDone: () => void }) {
  const [query,      setQuery]      = useState("")
  const [results,    setResults]    = useState<ClientSearchResult[]>([])
  const [dropOpen,   setDropOpen]   = useState(false)
  const [client,     setClient]     = useState<ClientSearchResult | null>(null)
  const [membershipId, setMembershipId] = useState<string | null>(null)
  const [amount,     setAmount]     = useState("")
  const [provider,   setProvider]   = useState<PayProvider>("cash")
  const [methods,    setMethods]    = useState<PayMethod[]>([])
  useEffect(() => { getPaymentMethodsAction().then((m) => { setMethods(m); const f = m.find((x) => x.available); if (f) setProvider(f.key as PayProvider) }).catch(() => {}) }, [])
  const [comment,    setComment]    = useState("")
  const [error,      setError]      = useState<string | null>(null)
  const [ok,         setOk]         = useState(false)
  const [pending,    start]         = useTransition()
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (debRef.current) clearTimeout(debRef.current)
    if (q.trim().length < 1) { setResults([]); setDropOpen(false); return }
    debRef.current = setTimeout(async () => {
      const res = await searchClientsPayments(q)
      setResults(res); setDropOpen(true)
    }, 200)
  }, [])

  useEffect(() => { if (!client) search(query) }, [query, client, search])

  useEffect(() => {
    if (!dropOpen) return
    const fn = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [dropOpen])

  function selectMembership(id: string | null) {
    setMembershipId(id)
    if (id) {
      const m = memberships.find((m) => m.id === id)
      if (m) setAmount(String(m.price))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!client) { setError("Выберите клиента"); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError("Введите сумму"); return }
    setError(null)
    start(async () => {
      const res = await createPaymentAction({ clientId: client.id, membershipId, amount: Number(amount), provider, comment })
      if (res.error) { setError(res.error); return }
      setOk(true)
      setTimeout(onDone, 1000)
    })
  }

  if (ok) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
      <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Оплата сохранена!</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client search */}
      <div>
        <FLabel required>Клиент</FLabel>
        {client ? (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
            <FInput
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя или телефон..."
              style={{ ...INP_STYLE, paddingLeft: 36 }}
              onFocus={() => { if (results.length) setDropOpen(true) }}
            />
            {dropOpen && results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-50 rounded-lg py-1"
                style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                {results.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setClient(r); setDropOpen(false); setQuery("") }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left">
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
        <FLabel>Абонемент</FLabel>
        <FSelect value={membershipId ?? ""} onChange={(e) => selectMembership(e.target.value || null)}>
          <option value="">— Без абонемента —</option>
          {memberships.map((m) => (
            <option key={m.id} value={m.id}>{m.name} — {m.price.toLocaleString("ru-RU")} сум</option>
          ))}
        </FSelect>
      </div>

      {/* Amount */}
      <div>
        <FLabel required>Сумма</FLabel>
        <FMoney value={amount} onChange={setAmount} placeholder="0" />
      </div>

      {/* Provider */}
      <div>
        <FLabel>Способ оплаты</FLabel>
        <div className="grid grid-cols-2 gap-2">
          {(methods.length ? methods.filter((m) => m.key !== "card") : PROVIDERS.map((p) => ({ key: p.value, label: p.label, available: true, online: false }))).map((m) => {
            const key = m.key as PayProvider
            const selected = provider === key
            return (
              <button key={key} type="button" onClick={() => m.available && setProvider(key)} disabled={!m.available}
                title={m.available ? undefined : "не подключён"}
                className="h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  border: selected ? "1.5px solid #2563eb" : "1.5px solid var(--border)",
                  background: selected ? "rgba(37,99,235,0.1)" : "var(--card)",
                  color: selected ? "#2563eb" : "var(--on-dark-soft)",
                }}>
                {m.label}
                {m.online && !m.available && <span className="text-[9px] font-medium px-1 rounded" style={{ background: "rgba(148,163,184,0.15)", color: "var(--gray-muted)" }}>не подкл.</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comment */}
      <div>
        <FLabel>Комментарий</FLabel>
        <FInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" />
      </div>

      <ErrMsg msg={error} />
      <SubmitBtn pending={pending} label="Сохранить оплату" pendingLabel="Сохранение..." />
    </form>
  )
}

// ── View: New membership ─────────────────────────────────────────────

function NewMembershipView({ onDone }: { onDone: () => void }) {
  const [name,       setName]       = useState("")
  const [price,      setPrice]      = useState("")
  const [duration,   setDuration]   = useState("")
  const [visits,     setVisits]     = useState("")
  const [error,      setError]      = useState<string | null>(null)
  const [ok,         setOk]         = useState(false)
  const [pending,    start]         = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Введите название"); return }
    if (!price || Number(price) <= 0) { setError("Введите цену"); return }
    setError(null)
    const fd = new FormData()
    fd.set("name", name.trim())
    fd.set("price", price)
    fd.set("duration_days", duration || "30")
    fd.set("visits_limit", visits)
    fd.set("freeze_allowed", "true")
    fd.set("freeze_days_allowed", "14")
    start(async () => {
      const res = await createMembershipAction({}, fd)
      if (res?.error) { setError(res.error); return }
      setOk(true)
      setTimeout(onDone, 1000)
    })
  }

  if (ok) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
      <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Абонемент создан!</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <FLabel required>Название</FLabel>
        <FInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Месячный безлимит" />
      </div>
      <div>
        <FLabel required>Цена</FLabel>
        <FMoney value={price} onChange={setPrice} placeholder="350000" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FLabel>Срок (дней)</FLabel>
          <FInput type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
        </div>
        <div>
          <FLabel>Лимит посещений</FLabel>
          <FInput type="number" value={visits} onChange={(e) => setVisits(e.target.value)} placeholder="Без лимита" />
        </div>
      </div>
      <ErrMsg msg={error} />
      <SubmitBtn pending={pending} label="Создать абонемент" pendingLabel="Создание..." />
    </form>
  )
}

// ── View: Quick visit check-in ───────────────────────────────────────

type Toast = { type: "ok" | "warn" | "err"; text: string }

function QuickVisitView() {
  const [query,   setQuery]   = useState("")
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState<Toast | null>(null)
  const [marking, startMark]  = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const debRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (debRef.current) clearTimeout(debRef.current)
    if (q.trim().length < 1) { setResults([]); setDropOpen(false); return }
    setLoading(true)
    debRef.current = setTimeout(async () => {
      const res = await searchClientsAction(q)
      setResults(res); setDropOpen(true); setLoading(false)
    }, 200)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  useEffect(() => {
    if (!dropOpen) return
    const fn = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [dropOpen])

  function showToast(t: Toast) {
    setToast(t)
    setTimeout(() => setToast(null), 3000)
  }

  function handleCheckin(client: ClientSearchResult) {
    setDropOpen(false); setQuery("")
    if (client.subscriptionStatus === "expired") {
      showToast({ type: "err", text: `${client.name} — абонемент истёк, сначала продлите` })
      return
    }
    startMark(async () => {
      const res = await markVisitAction(client.id, client.subscriptionId)
      if (res.error)        showToast({ type: "err",  text: res.error })
      else if (res.warning) showToast({ type: "warn", text: `Посещение отмечено. ⚠ ${res.warning}` })
      else                  showToast({ type: "ok",   text: `${client.name} — check-in выполнен` })
      inputRef.current?.focus()
    })
  }

  const ToastIcon = toast?.type === "ok" ? CheckCircle2 : toast?.type === "warn" ? AlertTriangle : AlertCircle
  const toastColors: Record<string, string> = { ok: "#16a34a", warn: "#d97706", err: "#dc2626" }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "var(--gray-muted)" }}>
        Введите имя или телефон клиента для check-in
      </p>
      <div className="relative" ref={wrapRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или телефон..."
          className="h-11 w-full rounded-lg text-sm outline-none"
          style={{ ...INP_STYLE, paddingLeft: 40, paddingRight: 12 }}
          onFocus={() => { if (results.length) setDropOpen(true) }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "#2563eb" }} />
          </div>
        )}
        {dropOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 top-12 z-50 rounded-xl overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            {results.map((r) => {
              const isExpired = r.subscriptionStatus === "expired" || (r.daysLeft !== null && r.daysLeft < 0)
              const isLow = !isExpired && r.visitsLeft !== null && r.visitsLeft <= 3
              return (
                <button key={r.id} type="button" onClick={() => handleCheckin(r)} disabled={marking}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: isExpired ? "#f87171" : "#60a5fa" }}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{r.name}</p>
                    <p className="text-xs" style={{ color: isExpired ? "#dc2626" : isLow ? "#d97706" : "var(--gray-muted)" }}>
                      {r.phone} {r.daysLeft !== null && !isExpired ? `· ${r.daysLeft} дн.` : isExpired ? "· Истёк" : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: "#2563eb" }}>Check-in</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: toast.type === "ok" ? "rgba(22,163,74,0.1)" : toast.type === "warn" ? "#fffbeb" : "rgba(220,38,38,0.1)", border: `1px solid ${toastColors[toast.type]}30` }}>
          <ToastIcon className="w-4 h-4 flex-shrink-0" style={{ color: toastColors[toast.type] }} />
          <p className="text-sm font-medium" style={{ color: toastColors[toast.type] }}>{toast.text}</p>
        </div>
      )}
    </div>
  )
}

// ── View: New staff ───────────────────────────────────────────────────

const SALARY_TYPES = [
  { key: "fixed",   label: "Фиксированная" },
  { key: "percent", label: "Процент с продаж" },
  { key: "mixed",   label: "Фикс + Процент" },
]

const ROLE_OPTIONS = [
  { value: "admin",      label: "Администратор" },
  { value: "trainer",    label: "Тренер"         },
  { value: "cashier",    label: "Кассир"          },
  { value: "accountant", label: "Бухгалтер"       },
  { value: "manager",    label: "Менеджер"        },
]

function NewStaffView({ onDone }: { onDone: () => void }) {
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [phone,   setPhone]   = useState("")
  const [role,    setRole]    = useState("trainer")
  const [salType, setSalType] = useState("fixed")
  const [fixed,   setFixed]   = useState("")
  const [pct,     setPct]     = useState("20")
  const [error,   setError]   = useState<string | null>(null)
  const [ok,      setOk]      = useState(false)
  const [pending, start]      = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError("Имя и Email обязательны"); return }
    setError(null)
    start(async () => {
      const res = await addStaffAction({
        name: name.trim(), email: email.trim(), phone: phone.trim(), role,
        salaryType: salType, salaryFixed: Number(fixed) || 0, salaryPercent: Number(pct) || 0,
      })
      if (res.error) { setError(res.error); return }
      setOk(true)
      setTimeout(onDone, 1000)
    })
  }

  if (ok) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <CheckCircle2 className="w-12 h-12" style={{ color: "#16a34a" }} />
      <p className="text-sm font-medium" style={{ color: "#16a34a" }}>Сотрудник добавлен!</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <FLabel required>Имя и фамилия</FLabel>
        <FInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Азиз Каримов" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FLabel required>Email</FLabel>
          <FInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aziz@club.uz" />
        </div>
        <div>
          <FLabel>Телефон</FLabel>
          <FInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" />
        </div>
      </div>
      <div>
        <FLabel>Должность</FLabel>
        <FSelect value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </FSelect>
      </div>
      <FSep />
      <div>
        <FLabel>Тип зарплаты</FLabel>
        <div className="grid grid-cols-3 gap-2">
          {SALARY_TYPES.map((s) => (
            <button key={s.key} type="button" onClick={() => setSalType(s.key)}
              className="h-9 rounded-lg text-xs font-medium transition-all"
              style={{
                border: salType === s.key ? "1.5px solid #2563eb" : "1.5px solid var(--border)",
                background: salType === s.key ? "rgba(37,99,235,0.1)" : "var(--card)",
                color: salType === s.key ? "#2563eb" : "var(--on-dark-soft)",
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {(salType === "fixed" || salType === "mixed") && (
        <div>
          <FLabel>Фикс. оклад</FLabel>
          <FMoney value={fixed} onChange={setFixed} placeholder="2000000" />
        </div>
      )}
      {(salType === "percent" || salType === "mixed") && (
        <div>
          <FLabel>Процент (%)</FLabel>
          <FInput type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20" />
        </div>
      )}
      <ErrMsg msg={error} />
      <SubmitBtn pending={pending} label="Добавить сотрудника" pendingLabel="Добавление..." />
    </form>
  )
}

// ── Main QuickActionsDrawer ──────────────────────────────────────────

const VIEW_LABELS: Record<QuickActionView, string> = {
  client:     "Новый клиент",
  payment:    "Новая оплата",
  membership: "Новый абонемент",
  visit:      "Отметить посещение",
  staff:      "Добавить сотрудника",
}

export function QuickActionsPanel({ view, onClose }: { view: QuickActionView; onClose: () => void }) {
  const [memberships, setMemberships] = useState<QuickMembership[] | null>(null)
  const [loadingM, setLoadingM]     = useState(false)

  useEffect(() => {
    if ((view === "client" || view === "payment") && memberships === null && !loadingM) {
      setLoadingM(true)
      getMembershipsForDrawer()
        .then(setMemberships)
        .finally(() => setLoadingM(false))
    }
  }, [view, memberships, loadingM])

  function close() {
    onClose()
  }

  function done() {
    close()
  }

  return (
    <div className="fixed inset-0 z-[200] flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(2,6,23,0.4)" }}
            onClick={close}
          />

          {/* Panel */}
          <div
            className="absolute top-0 right-0 bottom-0 flex flex-col"
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--card)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="flex-1 text-xl font-semibold" style={{ color: "var(--on-dark)", letterSpacing: "-0.12px" }}>
                {VIEW_LABELS[view]}
              </h2>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--on-dark-soft)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {view === "client" && (
                loadingM
                  ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "#2563eb" }} /></div>
                  : <NewClientView memberships={memberships ?? []} onDone={done} />
              )}

              {view === "payment" && (
                loadingM
                  ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "#2563eb" }} /></div>
                  : <NewPaymentView memberships={memberships ?? []} onDone={done} />
              )}

              {view === "membership" && <NewMembershipView onDone={done} />}
              {view === "visit"      && <QuickVisitView />}
              {view === "staff"      && <NewStaffView onDone={done} />}
            </div>
          </div>
    </div>
  )
}
