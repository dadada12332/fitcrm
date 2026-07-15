"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Check, X, Search, RefreshCw, ShieldCheck, CreditCard, Sparkles } from "lucide-react"
import type { ReconRow } from "@/lib/reconcile"
import type { ClientSearchResult } from "@/lib/visits"
import {
  confirmReconAction, ignoreReconAction, rematchReconAction, refreshReconAction,
  searchClientsReconAction, manualAttachAction,
} from "@/app/(app)/payments/reconcile/actions"

const fmtSum = (n: number) => n.toLocaleString("ru-RU")
const fmtTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const providerLabel: Record<string, string> = { click: "Click", payme: "Payme" }

export function ReconcileClient({ initialRows, connected }: { initialRows: ReconRow[]; connected: string[] }) {
  const [rows, setRows] = useState<ReconRow[]>(initialRows)
  const [pending, start] = useTransition()

  async function reload() { setRows(await refreshReconAction()) }

  const high = rows.filter((r) => r.status === "suggested" && !r.ambiguous && (r.confidence ?? 0) >= 85)
  const maybe = rows.filter((r) => r.status === "suggested" && ((r.confidence ?? 0) < 85 || r.ambiguous))
  const unknown = rows.filter((r) => r.status === "unmatched")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/payments" className="inline-flex items-center gap-1.5 text-sm mb-2" style={{ color: "var(--on-dark-soft)" }}>
            <ArrowLeft className="w-4 h-4" /> К оплатам
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Сверка эквайринга</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
            Оплаты через статичный QR подтягиваются из выписки и сопоставляются с продажами по сумме, времени и карте.
          </p>
        </div>
        <button
          onClick={() => start(async () => { await rematchReconAction(); await reload() })}
          disabled={pending}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium shrink-0 disabled:opacity-50"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
        >
          <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} /> Пересопоставить
        </button>
      </div>

      {connected.length === 0 && (
        <div className="rounded-lg px-5 py-4 text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
          Онлайн-платёжка не подключена. Подключите Click или Payme в <Link href="/settings/finance" className="underline" style={{ color: "#2563eb" }}>Настройках → Финансы</Link>, чтобы получать выписку для сверки.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <ShieldCheck className="w-8 h-8 mx-auto mb-3" style={{ color: "#16a34a" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Всё сверено</p>
          <p className="text-sm mt-1" style={{ color: "var(--gray-muted)" }}>Непривязанных поступлений из эквайринга нет.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {high.length > 0 && (
            <Section title="Высокая вероятность" hint="Совпали карта, сумма и время — подтвердите в один клик" accent="#16a34a" icon={<Sparkles className="w-4 h-4" style={{ color: "#16a34a" }} />}>
              {high.map((r) => <ReconCard key={r.id} r={r} pending={pending} start={start} reload={reload} />)}
            </Section>
          )}
          {maybe.length > 0 && (
            <Section title="Возможные совпадения" hint="Проверьте клиента и подтвердите или выберите вручную" accent="#d97706">
              {maybe.map((r) => <ReconCard key={r.id} r={r} pending={pending} start={start} reload={reload} />)}
            </Section>
          )}
          {unknown.length > 0 && (
            <Section title="Не распознано" hint="Нет подходящей продажи в СРМ — привяжите к клиенту вручную или проигнорируйте" accent="var(--gray-muted)">
              {unknown.map((r) => <ReconCard key={r.id} r={r} pending={pending} start={start} reload={reload} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, hint, accent, icon, children }: { title: string; hint: string; accent: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--border)", color: accent }}>{hint}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null
  const color = value >= 85 ? "#16a34a" : value >= 60 ? "#d97706" : "var(--gray-muted)"
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
      {value}% совпадение
    </span>
  )
}

function ReconCard({ r, pending, start, reload }: {
  r: ReconRow; pending: boolean; start: React.TransitionStartFunction; reload: () => Promise<void>
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const hasSuggestion = !!r.suggestedPaymentId && r.status === "suggested"

  function confirm() {
    if (!r.suggestedPaymentId) return
    setMsg(null)
    start(async () => {
      const res = await confirmReconAction(r.id, r.suggestedPaymentId!)
      if (res.error) { setMsg(res.error); return }
      await reload()
    })
  }
  function ignore() {
    setMsg(null)
    start(async () => { const res = await ignoreReconAction(r.id); if (res.error) { setMsg(res.error); return } await reload() })
  }

  return (
    <div className="rounded-lg px-5 py-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-4 flex-wrap">
        {/* Поступление из эквайринга */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, #2563eb 12%, transparent)" }}>
            <CreditCard className="w-4 h-4" style={{ color: "#2563eb" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
              {fmtSum(r.amount)} <span className="font-normal text-xs" style={{ color: "var(--gray-muted)" }}>сум</span>
            </p>
            <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>
              {providerLabel[r.provider] ?? r.provider} · {fmtTime(r.paidAt)}{r.cardMask ? ` · ${r.cardMask}` : ""}
            </p>
          </div>
        </div>

        {/* Предполагаемый клиент */}
        {hasSuggestion && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs" style={{ color: "var(--gray-muted)" }}>→</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{r.clientName ?? "Клиент"}</p>
              {r.serviceName && <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>{r.serviceName}</p>}
            </div>
            <ConfidenceBadge value={r.confidence} />
            {r.ambiguous && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, #d97706 12%, transparent)", color: "#d97706" }}>несколько вариантов</span>}
          </div>
        )}

        {/* Действия */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {hasSuggestion && (
            <button onClick={confirm} disabled={pending}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#16a34a" }}>
              <Check className="w-4 h-4" /> Подтвердить
            </button>
          )}
          <button onClick={() => setAttaching((v) => !v)} disabled={pending}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
            <Search className="w-4 h-4" /> {hasSuggestion ? "Другой клиент" : "Привязать"}
          </button>
          <button onClick={ignore} disabled={pending} title="Игнорировать"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-50"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--gray-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {msg && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{msg}</p>}
      {attaching && <AttachPicker txnId={r.id} pending={pending} start={start} onDone={async () => { setAttaching(false); await reload() }} onError={setMsg} />}
    </div>
  )
}

function AttachPicker({ txnId, pending, start, onDone, onError }: {
  txnId: string; pending: boolean; start: React.TransitionStartFunction
  onDone: () => Promise<void>; onError: (m: string) => void
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(v: string) {
    setQ(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => { setResults(await searchClientsReconAction(v.trim())) }, 250)
  }
  function pick(clientId: string) {
    start(async () => {
      const res = await manualAttachAction(txnId, clientId)
      if (res.error) { onError(res.error); return }
      await onDone()
    })
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
        <input autoFocus value={q} onChange={(e) => onChange(e.target.value)} placeholder="Поиск клиента по имени или телефону…"
          className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
          {results.map((c) => (
            <button key={c.id} onClick={() => pick(c.id)} disabled={pending}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              style={{ border: "1px solid var(--border-subtle)" }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{c.name}</p>
                {c.phone && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{c.phone}</p>}
              </div>
              <Check className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
