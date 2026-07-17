"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Search, Loader2, SendHorizontal, ChevronDown, Building2, Monitor,
  FileText, AlertTriangle, Clock, Star, RefreshCw, ArrowLeft,
} from "lucide-react"
import { PT } from "@/components/platform/parts"
import { createClient } from "@/lib/supabase/client"
import {
  pfListTicketsAction, pfGetTicketAction, pfReplyAction, pfSetStatusAction,
  type PfTicketRow, type PfTicketDetail, type PfStatus,
} from "@/app/platform/(protected)/support/actions"

const STATUS: Record<PfStatus, { label: string; dot: string; bg: string; color: string }> = {
  new:         { label: "Новый",            dot: "var(--brand)", bg: "color-mix(in srgb, var(--brand) 14%, transparent)", color: "var(--brand)" },
  in_progress: { label: "В работе",         dot: "var(--chart-3)", bg: "color-mix(in srgb, var(--chart-3) 14%, transparent)", color: "var(--chart-3)" },
  needs_info:  { label: "Требуются данные", dot: "var(--destructive)", bg: "color-mix(in srgb, var(--destructive) 14%, transparent)", color: "var(--destructive)" },
  resolved:    { label: "Решено",           dot: "var(--chart-2)", bg: "color-mix(in srgb, var(--chart-2) 14%, transparent)", color: "var(--chart-2)" },
  closed:      { label: "Закрыт",           dot: "var(--muted-foreground)", bg: "color-mix(in srgb, var(--muted-foreground) 16%, transparent)", color: "var(--muted-foreground)" },
}
const CAT_LABEL: Record<string, string> = {
  import: "Импорт", payments: "Оплаты", integrations: "Интеграции", subscription: "Подписка",
  error: "Ошибка", feature: "Предложение", other: "Другое",
}
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "needs_info", label: "Ждут данных" },
  { key: "resolved", label: "Решённые" },
  { key: "closed", label: "Закрытые" },
]

function relTime(iso: string): string {
  const d = new Date(iso), now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return "только что"
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

export function PlatformSupportConsole({ initialRows, initialCounts }: { initialRows: PfTicketRow[]; initialCounts: Record<string, number> }) {
  const [rows, setRows] = useState<PfTicketRow[]>(initialRows)
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)
  const [tab, setTab] = useState("all")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { rows, counts } = await pfListTicketsAction({ status: tab, q })
    setRows(rows); setCounts(counts); setLoading(false)
  }, [tab, q])

  useEffect(() => { refresh() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: у платформенного админа user_club_ids() = все клубы, поэтому RLS
  // пускает подписку на все тикеты. Новые обращения/ответы прилетают моментально.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    const supabase = createClient()
    let t: ReturnType<typeof setTimeout> | null = null
    const ping = () => { if (t) clearTimeout(t); t = setTimeout(() => refreshRef.current(), 400) }
    const ch = supabase
      .channel("platform-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, ping)
      .subscribe()
    // Фолбэк-поллинг на случай обрыва realtime
    const iv = setInterval(() => refreshRef.current(), 60000)
    return () => { if (t) clearTimeout(t); clearInterval(iv); supabase.removeChannel(ch) }
  }, [])

  return (
    <div className="h-[calc(100dvh-160px)] min-h-[520px] overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Список */}
        <div className={`${selected ? "hidden lg:flex" : "flex"} h-full flex-col border-r border-border bg-card`}>
          <div className="p-3 space-y-2.5" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: PT.textMuted }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && refresh()}
                  placeholder="Поиск: тема, клуб, #номер"
                  className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
                  style={{ background: PT.bg, border: `1px solid ${PT.panelBorder}`, color: PT.text }} />
              </div>
              <button onClick={refresh} className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: PT.bg, border: `1px solid ${PT.panelBorder}`, color: PT.textSoft }}>
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {TABS.map((t) => {
                const active = tab === t.key
                const c = counts[t.key] ?? (t.key === "all" ? counts.all : 0)
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                    style={{ background: active ? "color-mix(in srgb, var(--brand) 12%, transparent)" : "transparent", color: active ? "var(--brand)" : PT.textMuted, border: `1px solid ${active ? "color-mix(in srgb, var(--brand) 35%, transparent)" : "transparent"}` }}>
                    {t.label}{c ? ` ${c}` : ""}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 && <div className="text-center text-sm py-16" style={{ color: PT.textMuted }}>Обращений нет</div>}
            {rows.map((t) => {
              const active = t.id === selected
              return (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className="w-full text-left px-3.5 py-3 transition-colors"
                  style={{ background: active ? "color-mix(in srgb, var(--brand) 8%, transparent)" : "transparent", borderBottom: `1px solid ${PT.panelBorder}`, borderLeft: `2px solid ${active ? "var(--brand)" : "transparent"}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS[t.status].dot }} />
                    <span className="text-sm truncate flex-1" style={{ color: PT.text, fontWeight: t.agentUnread ? 600 : 500 }}>{t.subject}</span>
                    {t.agentUnread && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">NEW</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: PT.textMuted }}>
                    <Building2 size={11} /> <span className="truncate max-w-[120px]">{t.clubName}</span>
                    <span>· #{t.ticketNo}</span>
                    <span className="ml-auto">{relTime(t.lastMessageAt)}</span>
                  </div>
                  {t.preview && <div className="text-xs truncate mt-1" style={{ color: PT.textSoft }}>{t.preview}</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Тред */}
        <div className={`${selected ? "flex" : "hidden lg:flex"} h-full min-w-0 flex-col bg-background`}>
          {selected
            ? <OpThread key={selected} ticketId={selected} onChanged={refresh} onBack={() => setSelected(null)} />
            : <div className="flex-1 flex items-center justify-center text-sm" style={{ color: PT.textMuted }}>Выберите обращение</div>}
        </div>
      </div>
    </div>
  )
}

function OpThread({ ticketId, onChanged, onBack }: { ticketId: string; onChanged: () => void; onBack: () => void }) {
  const [ticket, setTicket] = useState<PfTicketDetail | null>(null)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [showDiag, setShowDiag] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { ticket } = await pfGetTicketAction(ticketId)
    setTicket(ticket); onChanged()
  }, [ticketId, onChanged])

  useEffect(() => { load() }, [load])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [ticket?.messages.length])

  async function reply() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setText("")
    await pfReplyAction(ticketId, body)
    await load(); setSending(false)
  }
  async function setStatus(s: PfStatus) {
    setStatusOpen(false)
    await pfSetStatusAction(ticketId, s)
    await load()
  }

  if (!ticket) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" size={20} style={{ color: PT.textMuted }} /></div>

  const meta = ticket.clientMeta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsErr = (meta.last_js_errors as any[]) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiErr = (meta.last_api_errors as any[]) ?? []

  return (
    <>
      {/* Шапка */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap" style={{ borderBottom: `1px solid ${PT.panelBorder}`, background: PT.panel }}>
        <button type="button" onClick={onBack} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden" aria-label="Вернуться к обращениям">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: PT.text }}>{ticket.subject}</div>
          <div className="text-xs flex items-center gap-2" style={{ color: PT.textMuted }}>
            <Building2 size={11} /> {ticket.clubName} · {CAT_LABEL[ticket.category] ?? ticket.category} · #{ticket.ticketNo}
          </div>
        </div>
        {/* смена статуса */}
        <div className="relative order-4 ml-11 basis-full lg:order-none lg:ml-0 lg:basis-auto">
          <button onClick={() => setStatusOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: STATUS[ticket.status].bg, color: STATUS[ticket.status].color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[ticket.status].dot }} />
            {STATUS[ticket.status].label} <ChevronDown size={13} />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl">
              {(Object.keys(STATUS) as PfStatus[]).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/60" style={{ color: PT.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[s].dot }} /> {STATUS[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowDiag((v) => !v)} title="Диагностика"
          className="order-3 flex size-8 items-center justify-center rounded-lg lg:order-none" style={{ background: showDiag ? "color-mix(in srgb, var(--brand) 18%, transparent)" : PT.bg, border: `1px solid ${PT.panelBorder}`, color: showDiag ? "var(--brand)" : PT.textSoft }}>
          <Monitor size={15} />
        </button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Лента */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {ticket.messages.map((m) => {
            if (m.authorType === "system") return <div key={m.id} className="text-center text-xs py-1" style={{ color: PT.textMuted }}>{m.body}</div>
            const mine = m.authorType === "agent"        // «мы» (оператор) — справа
            const isAi = m.authorType === "ai"
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div className="text-xs mb-1" style={{ color: PT.textMuted, textAlign: mine ? "right" : "left" }}>
                    {mine ? "Поддержка (вы)" : isAi ? "AI Помощник" : ticket.clubName}
                  </div>
                  <div className="px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words"
                    style={{ borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: mine ? PT.accent : PT.panel, color: mine ? "var(--primary-foreground)" : PT.text, border: mine ? "none" : `1px solid ${PT.panelBorder}` }}>
                    {m.body}
                    {m.attachments.map((a) => (
                      a.mimeType?.startsWith("image/")
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block mt-1.5"><img src={a.url} alt={a.fileName} className="rounded-lg max-w-[220px] max-h-[220px] object-cover" /></a>
                        : a.mimeType?.startsWith("video/")
                          ? <video key={a.id} src={a.url} controls className="rounded-lg max-w-[240px] mt-1.5" />
                          : <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2.5 py-2 rounded-lg mt-1.5 text-xs" style={{ background: PT.bg, color: PT.text, border: `1px solid ${PT.panelBorder}` }}><FileText size={14} /> {a.fileName}</a>
                    ))}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: PT.textMuted, textAlign: mine ? "right" : "left" }}>
                    {new Date(m.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            )
          })}
          {ticket.csatRating != null && (
            <div className="mx-auto text-center text-xs py-2" style={{ color: PT.textMuted }}>
              Оценка клуба: {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className="inline" style={{ color: i < ticket.csatRating! ? "var(--chart-3)" : PT.panelBorder }} fill={i < ticket.csatRating! ? "var(--chart-3)" : "none"} />)}
              {ticket.csatComment ? ` — «${ticket.csatComment}»` : ""}
            </div>
          )}
        </div>

        {/* Диагностика */}
        {showDiag && (
          <div className="absolute inset-y-0 right-0 w-[min(300px,85%)] overflow-y-auto border-l border-border bg-card p-4 text-xs shadow-xl lg:static lg:w-[300px] lg:shrink-0 lg:shadow-none">
            <div className="font-semibold text-sm" style={{ color: PT.text }}>Автодиагностика</div>
            <DiagRow label="Клуб" value={ticket.clubName} />
            <DiagRow label="Версия CRM" value={String(meta.app_version ?? "—")} />
            <DiagRow label="Последний экран" value={String(meta.last_route ?? "—")} />
            <DiagRow label="Браузер / ОС" value={String(meta.user_agent ?? "—")} mono />
            <DiagRow label="Экран" value={`${meta.viewport ?? "—"} · ${meta.screen ?? ""}`} />
            <DiagRow label="Таймзона" value={String(meta.tz ?? "—")} />
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: PT.textSoft }}><AlertTriangle size={12} /> JS-ошибки ({jsErr.length})</div>
              {jsErr.length === 0 ? <div style={{ color: PT.textMuted }}>нет</div> : jsErr.map((e, i) => (
                <div key={i} className="rounded px-2 py-1 mb-1" style={{ background: PT.bg, color: "var(--destructive)" }}>{e.message}{e.source ? <span style={{ color: PT.textMuted }}> · {e.source}</span> : null}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: PT.textSoft }}><Clock size={12} /> API-ошибки ({apiErr.length})</div>
              {apiErr.length === 0 ? <div style={{ color: PT.textMuted }}>нет</div> : apiErr.map((e, i) => (
                <div key={i} className="rounded px-2 py-1 mb-1 font-mono" style={{ background: PT.bg, color: "var(--chart-3)" }}>{e.status} {e.method} {e.path}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ответ оператора */}
      {ticket.status === "closed" ? (
        <div className="px-4 py-4 text-center text-sm" style={{ borderTop: `1px solid ${PT.panelBorder}`, color: PT.textMuted, background: PT.panel }}>Обращение закрыто</div>
      ) : (
        <div className="p-3" style={{ borderTop: `1px solid ${PT.panelBorder}`, background: PT.panel }}>
          <div className="flex items-end gap-2 rounded-lg px-3 py-2" style={{ background: PT.bg, border: `1px solid ${PT.panelBorder}` }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reply() } }}
              rows={1} placeholder="Ответить клубу…" className="flex-1 resize-none bg-transparent text-sm outline-none py-1 max-h-32" style={{ color: PT.text }} />
            <button onClick={reply} disabled={!text.trim() || sending}
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function DiagRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: PT.textMuted }}>{label}</div>
      <div className={mono ? "font-mono break-all" : "break-words"} style={{ color: PT.text }}>{value}</div>
    </div>
  )
}
