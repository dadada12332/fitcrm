"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Search, Loader2, SendHorizontal, ChevronDown, Building2, Monitor,
  FileText, AlertTriangle, Clock, Star, RefreshCw,
} from "lucide-react"
import { PT } from "@/components/platform/parts"
import { createClient } from "@/lib/supabase/client"
import {
  pfListTicketsAction, pfGetTicketAction, pfReplyAction, pfSetStatusAction,
  type PfTicketRow, type PfTicketDetail, type PfStatus,
} from "@/app/platform/(protected)/support/actions"

const STATUS: Record<PfStatus, { label: string; dot: string; bg: string; color: string }> = {
  new:         { label: "Новый",            dot: "#3b82f6", bg: "rgba(59,130,246,0.14)", color: "#93c5fd" },
  in_progress: { label: "В работе",         dot: "#f59e0b", bg: "rgba(245,158,11,0.14)", color: "#fcd34d" },
  needs_info:  { label: "Требуются данные", dot: "#ef4444", bg: "rgba(239,68,68,0.14)",  color: "#fca5a5" },
  resolved:    { label: "Решено",           dot: "#22c55e", bg: "rgba(34,197,94,0.14)",  color: "#86efac" },
  closed:      { label: "Закрыт",           dot: "#64748b", bg: "rgba(100,116,139,0.16)", color: "#cbd5e1" },
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
  const [selected, setSelected] = useState<string | null>(initialRows[0]?.id ?? null)
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
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${PT.panelBorder}`, height: "calc(100vh - 190px)", minHeight: 520 }}>
      <div className="grid h-full" style={{ gridTemplateColumns: "minmax(0,380px) 1fr" }}>
        {/* Список */}
        <div className="flex flex-col h-full" style={{ borderRight: `1px solid ${PT.panelBorder}`, background: PT.panel }}>
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
                    style={{ background: active ? "rgba(99,102,241,0.18)" : "transparent", color: active ? "#c7d2fe" : PT.textMuted, border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "transparent"}` }}>
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
                  style={{ background: active ? "rgba(99,102,241,0.08)" : "transparent", borderBottom: `1px solid ${PT.panelBorder}`, borderLeft: `2px solid ${active ? PT.accent : "transparent"}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS[t.status].dot }} />
                    <span className="text-sm truncate flex-1" style={{ color: PT.text, fontWeight: t.agentUnread ? 600 : 500 }}>{t.subject}</span>
                    {t.agentUnread && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }}>NEW</span>}
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
        <div className="h-full flex flex-col" style={{ background: PT.bg }}>
          {selected
            ? <OpThread key={selected} ticketId={selected} onChanged={refresh} />
            : <div className="flex-1 flex items-center justify-center text-sm" style={{ color: PT.textMuted }}>Выберите обращение</div>}
        </div>
      </div>
    </div>
  )
}

function OpThread({ ticketId, onChanged }: { ticketId: string; onChanged: () => void }) {
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
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${PT.panelBorder}`, background: PT.panel }}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: PT.text }}>{ticket.subject}</div>
          <div className="text-xs flex items-center gap-2" style={{ color: PT.textMuted }}>
            <Building2 size={11} /> {ticket.clubName} · {CAT_LABEL[ticket.category] ?? ticket.category} · #{ticket.ticketNo}
          </div>
        </div>
        {/* смена статуса */}
        <div className="relative">
          <button onClick={() => setStatusOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: STATUS[ticket.status].bg, color: STATUS[ticket.status].color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[ticket.status].dot }} />
            {STATUS[ticket.status].label} <ChevronDown size={13} />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden py-1 min-w-[170px]" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              {(Object.keys(STATUS) as PfStatus[]).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5" style={{ color: PT.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[s].dot }} /> {STATUS[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowDiag((v) => !v)} title="Диагностика"
          className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: showDiag ? "rgba(99,102,241,0.18)" : PT.bg, border: `1px solid ${PT.panelBorder}`, color: showDiag ? "#c7d2fe" : PT.textSoft }}>
          <Monitor size={15} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
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
                      background: mine ? PT.accent : PT.panel, color: mine ? "#fff" : PT.text, border: mine ? "none" : `1px solid ${PT.panelBorder}` }}>
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
              Оценка клуба: {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className="inline" style={{ color: i < ticket.csatRating! ? "#f59e0b" : PT.panelBorder }} fill={i < ticket.csatRating! ? "#f59e0b" : "none"} />)}
              {ticket.csatComment ? ` — «${ticket.csatComment}»` : ""}
            </div>
          )}
        </div>

        {/* Диагностика */}
        {showDiag && (
          <div className="w-[300px] flex-shrink-0 overflow-y-auto p-4 space-y-3 text-xs" style={{ borderLeft: `1px solid ${PT.panelBorder}`, background: PT.panel }}>
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
                <div key={i} className="rounded px-2 py-1 mb-1" style={{ background: PT.bg, color: "#fca5a5" }}>{e.message}{e.source ? <span style={{ color: PT.textMuted }}> · {e.source}</span> : null}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: PT.textSoft }}><Clock size={12} /> API-ошибки ({apiErr.length})</div>
              {apiErr.length === 0 ? <div style={{ color: PT.textMuted }}>нет</div> : apiErr.map((e, i) => (
                <div key={i} className="rounded px-2 py-1 mb-1 font-mono" style={{ background: PT.bg, color: "#fcd34d" }}>{e.status} {e.method} {e.path}</div>
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
          <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: PT.bg, border: `1px solid ${PT.panelBorder}` }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reply() } }}
              rows={1} placeholder="Ответить клубу…" className="flex-1 resize-none bg-transparent text-sm outline-none py-1 max-h-32" style={{ color: PT.text }} />
            <button onClick={reply} disabled={!text.trim() || sending}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white disabled:opacity-40 flex-shrink-0" style={{ background: PT.accent }}>
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
