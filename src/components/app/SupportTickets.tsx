"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Plus, Search, ArrowLeft, SendHorizontal, MessageSquarePlus,
  Loader2, Star, X, Inbox, Paperclip, FileText, Film, Download,
} from "lucide-react"
import {
  listTicketsAction, getTicketAction, createTicketAction,
  sendTicketMessageAction, rateTicketAction, uploadSupportFileAction,
  type TicketListItem, type TicketDetail, type TicketStatus, type TicketCategory,
  type TicketAttachment, type AttachmentInput,
} from "@/app/(app)/support/actions"
import { collectClientMeta } from "@/lib/diagnostics"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/lib/use-action"

// ── Справочники ─────────────────────────────────────────────────────────
const STATUS: Record<TicketStatus, { label: string; dot: string; bg: string; color: string }> = {
  new:         { label: "Новый",            dot: "#2563eb", bg: "rgba(37,99,235,0.12)",  color: "#2563eb" },
  in_progress: { label: "В работе",         dot: "#d97706", bg: "rgba(217,119,6,0.12)",  color: "#b45309" },
  needs_info:  { label: "Требуются данные", dot: "#dc2626", bg: "rgba(220,38,38,0.12)",  color: "#dc2626" },
  resolved:    { label: "Решено",           dot: "#16a34a", bg: "rgba(22,163,74,0.12)",  color: "#16a34a" },
  closed:      { label: "Закрыт",           dot: "#6b7280", bg: "rgba(107,114,128,0.14)", color: "#6b7280" },
}

const CATEGORIES: { key: TicketCategory; label: string }[] = [
  { key: "import",        label: "Импорт" },
  { key: "payments",      label: "Оплаты" },
  { key: "integrations",  label: "Интеграции" },
  { key: "subscription",  label: "Подписка" },
  { key: "error",         label: "Ошибка" },
  { key: "feature",       label: "Предложение" },
  { key: "other",         label: "Другое" },
]
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<TicketCategory, string>

function relTime(iso: string): string {
  const d = new Date(iso), now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return "только что"
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  const sameDay = d.toDateString() === now.toDateString()
  const yst = new Date(now); yst.setDate(now.getDate() - 1)
  if (sameDay) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === yst.toDateString()) return "вчера"
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

function fmtSize(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`
  return `${(n / 1024 / 1024).toFixed(1)} МБ`
}

async function uploadFiles(files: File[]): Promise<{ uploaded: AttachmentInput[]; error?: string }> {
  const uploaded: AttachmentInput[] = []
  for (const f of files) {
    const fd = new FormData()
    fd.append("file", f)
    const { file, error } = await uploadSupportFileAction(fd)
    if (error || !file) return { uploaded, error: error ?? "Не удалось загрузить файл" }
    uploaded.push(file)
  }
  return { uploaded }
}

// Выбранные, но ещё не отправленные файлы
function PendingChips({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
          {f.type.startsWith("image/") ? "🖼️" : f.type.startsWith("video/") ? "🎬" : "📄"} <span className="max-w-[140px] truncate">{f.name}</span>
          <button onClick={() => onRemove(i)} className="w-4 h-4 flex items-center justify-center rounded"><X size={11} /></button>
        </span>
      ))}
    </div>
  )
}

// Уже отправленные вложения в ленте
function AttachmentView({ att, mine }: { att: TicketAttachment; mine: boolean }) {
  const mime = att.mimeType ?? ""
  if (mime.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <a href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.fileName} className="rounded-lg max-w-[220px] max-h-[220px] object-cover mt-1.5" /></a>
  }
  if (mime.startsWith("video/")) {
    return <video src={att.url} controls className="rounded-lg max-w-[240px] mt-1.5" />
  }
  const isPdf = mime.includes("pdf")
  return (
    <a href={att.url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-2 px-2.5 py-2 rounded-lg mt-1.5 text-xs"
      style={{ background: mine ? "rgba(255,255,255,0.15)" : "var(--card-2)", color: mine ? "#fff" : "var(--on-dark)", border: mine ? "none" : "1px solid var(--border)" }}>
      {mime.startsWith("video/") ? <Film size={15} /> : <FileText size={15} />}
      <span className="max-w-[160px] truncate">{att.fileName}</span>
      <span style={{ opacity: 0.7 }}>{fmtSize(att.sizeBytes)}</span>
      {isPdf ? <Download size={13} style={{ opacity: 0.8 }} /> : <Download size={13} style={{ opacity: 0.8 }} />}
    </a>
  )
}

const ACCEPT = "image/*,video/*,application/pdf,.xlsx,.xls,.csv"

export function SupportTickets({ clubId }: { clubId: string }) {
  const params = useSearchParams()
  const router = useRouter()
  // Выбор — локальное состояние (мгновенный и надёжный клик), URL синхронизируется для диплинков.
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"))
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  // Диплинк из URL (эскалация из AI / уведомление) → открыть тикет.
  useEffect(() => {
    const urlId = params.get("id")
    if (urlId && urlId !== selectedId) setSelectedId(urlId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const [tickets, setTickets] = useState<TicketListItem[] | null>(null)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    const { tickets } = await listTicketsAction()
    setTickets(tickets)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Реалтайм: подписка на изменения тикетов клуба (ответы поддержки без перезагрузки)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`support-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `club_id=eq.${clubId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          refresh()
          const row = payload.new
          if (row?.id === selectedRef.current) { setReloadKey((k) => k + 1); return }
          const agentReplied = row?.agent_last_read_at && (!row?.user_last_read_at || new Date(row.agent_last_read_at) > new Date(row.user_last_read_at))
          if (agentReplied) {
            setToast("Поддержка ответила на ваше обращение")
            setTimeout(() => setToast(null), 5000)
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [clubId, refresh])

  function select(id: string | null) {
    setSelectedId(id)                    // мгновенно
    const sp = new URLSearchParams(Array.from(params.entries()))
    sp.set("tab", "tickets")
    if (id) sp.set("id", id); else sp.delete("id")
    router.replace(`/support?${sp.toString()}`, { scroll: false })  // синхронизация URL (best-effort)
  }

  const filtered = (tickets ?? []).filter((t) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return t.subject.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q) || CAT_LABEL[t.category].toLowerCase().includes(q)
  })

  const isEmpty = tickets !== null && tickets.length === 0

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", height: "calc(100vh - 230px)", minHeight: 480 }}>
      <div className="grid h-full" style={{ gridTemplateColumns: "minmax(0, 340px) 1fr" }}>
        {/* ── Список ── */}
        <div className={`flex flex-col h-full ${selectedId ? "hidden md:flex" : "flex"}`} style={{ borderRight: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="p-3 space-y-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#2563eb" }}>
              <Plus size={16} /> Создать обращение
            </button>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по обращениям…"
                className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tickets === null && (
              <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" size={20} style={{ color: "var(--gray-muted)" }} /></div>
            )}
            {isEmpty && <SidebarEmpty onCreate={() => setCreating(true)} />}
            {filtered.map((t) => {
              const active = t.id === selectedId
              return (
                <button key={t.id} onClick={() => select(t.id)}
                  className="w-full text-left px-3.5 py-3 transition-colors"
                  style={{ background: active ? "var(--card-2)" : "transparent", borderBottom: "1px solid var(--border)",
                    borderLeft: active ? "2px solid #2563eb" : "2px solid transparent" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS[t.status].dot }} />
                    <span className="text-sm truncate flex-1" style={{ color: "var(--on-dark)", fontWeight: t.unread ? 600 : 500 }}>{t.subject}</span>
                    {t.unread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#2563eb" }} />}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--gray-muted)" }}>
                    <span>{CAT_LABEL[t.category]}</span>
                    <span>·</span>
                    <span>#{t.ticketNo}</span>
                    <span className="ml-auto">{relTime(t.lastMessageAt)}</span>
                  </div>
                  {t.preview && <div className="text-xs truncate mt-1" style={{ color: "var(--on-dark-soft)" }}>{t.preview}</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Тред ── */}
        <div className={`h-full ${selectedId ? "flex" : "hidden md:flex"} flex-col`} style={{ background: "var(--bg, transparent)" }}>
          {selectedId
            ? <Thread key={selectedId} ticketId={selectedId} reloadKey={reloadKey} onBack={() => select(null)} onChanged={refresh} onCreateNew={() => setCreating(true)} />
            : <ThreadEmpty empty={isEmpty} onCreate={() => setCreating(true)} />}
        </div>
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refresh(); select(id) }} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-white shadow-lg"
          style={{ background: "#111827" }}>
          <MessageSquarePlus size={16} /> {toast}
        </div>
      )}
    </div>
  )
}

// ── Пустой список ─────────────────────────────────────────────────────────
function SidebarEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Обращений пока нет</p>
      <button onClick={onCreate} className="text-sm font-medium mt-2" style={{ color: "#2563eb" }}>Создать первое</button>
    </div>
  )
}

function ThreadEmpty({ empty, onCreate }: { empty: boolean; onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(37,99,235,0.10)" }}>
        <Inbox size={26} style={{ color: "#2563eb" }} />
      </div>
      {empty ? (
        <>
          <h3 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>У вас пока нет обращений</h3>
          <p className="text-sm mt-1 max-w-xs" style={{ color: "var(--on-dark-soft)" }}>
            Если возникнет вопрос — мы всегда рядом. Ответим прямо здесь, в CRM.
          </p>
          <button onClick={onCreate}
            className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#2563eb" }}>
            <Plus size={16} /> Создать обращение
          </button>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Выберите обращение</h3>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Слева — список ваших обращений</p>
        </>
      )}
    </div>
  )
}

// ── Переписка ───────────────────────────────────────────────────────────
function Thread({ ticketId, reloadKey, onBack, onChanged, onCreateNew }: { ticketId: string; reloadKey: number; onBack: () => void; onChanged: () => void; onCreateNew: () => void }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [err, setErr] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { ticket } = await getTicketAction(ticketId)
    setTicket(ticket)
    onChanged()
  }, [ticketId, onChanged])

  useEffect(() => { load() }, [load])
  // реалтайм-сигнал из родителя → тихо перезагрузить тред
  useEffect(() => { if (reloadKey > 0) load() }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [ticket?.messages.length])

  async function send() {
    const body = text.trim()
    if ((!body && !files.length) || sending) return
    setSending(true); setErr("")
    const pending = files
    setText(""); setFiles([])

    // Оптимистично показываем сообщение сразу (текст без вложений) — сервер подтвердит через load()
    const optimistic = pending.length === 0 && body
    if (optimistic && ticket) {
      setTicket({
        ...ticket,
        messages: [...ticket.messages, {
          id: `optimistic-${Date.now()}`, authorType: "user", body, createdAt: new Date().toISOString(), meta: {}, attachments: [],
        }],
      })
    }

    let uploaded: AttachmentInput[] = []
    if (pending.length) {
      const res = await uploadFiles(pending)
      if (res.error) { setErr(res.error); toast.error(res.error); setFiles(pending); setSending(false); return }
      uploaded = res.uploaded
    }
    const res = await sendTicketMessageAction(ticketId, body, uploaded)
    if (res?.error) { setErr(res.error); toast.error(res.error); setText(body); setFiles(pending) }
    await load()   // сверяем истину (заменяет оптимистичное сообщение реальным)
    setSending(false)
  }

  if (!ticket) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" size={20} style={{ color: "var(--gray-muted)" }} /></div>

  // завершённое обращение (решено/закрыто) — чат заблокирован, можно только создать новое
  const locked = ticket.status === "closed" || ticket.status === "resolved"

  return (
    <>
      {/* Шапка треда */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
        <button onClick={onBack} className="md:hidden -ml-1 p-1"><ArrowLeft size={18} style={{ color: "var(--on-dark-soft)" }} /></button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: "var(--on-dark)" }}>{ticket.subject}</div>
          <div className="text-xs" style={{ color: "var(--gray-muted)" }}>{CAT_LABEL[ticket.category]} · #{ticket.ticketNo}</div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Лента */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {ticket.messages.map((m) => {
          if (m.authorType === "system") {
            return <div key={m.id} className="text-center text-xs py-1" style={{ color: "var(--gray-muted)" }}>{m.body}</div>
          }
          const mine = m.authorType === "user"
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%]">
                {!mine && <div className="text-xs mb-1 ml-1" style={{ color: "var(--gray-muted)" }}>{m.authorType === "ai" ? "AI Помощник" : "Поддержка"}</div>}
                <div className="px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words"
                  style={{
                    borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: mine ? "#2563eb" : "var(--card)",
                    color: mine ? "#fff" : "var(--on-dark)",
                    border: mine ? "none" : "1px solid var(--border)",
                  }}>
                  {m.body}
                  {m.attachments.length > 0 && (
                    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {m.attachments.map((a) => <AttachmentView key={a.id} att={a} mine={mine} />)}
                    </div>
                  )}
                </div>
                <div className={`text-[11px] mt-1 ${mine ? "text-right mr-1" : "ml-1"}`} style={{ color: "var(--gray-muted)" }}>
                  {new Date(m.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          )
        })}

        {ticket.status === "resolved" && <RateBlock ticketId={ticketId} initial={ticket.csatRating} onDone={load} />}
      </div>

      {/* Ввод */}
      {locked ? (
        <div className="px-4 py-4 flex flex-col items-center gap-2 text-center" style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
          <span className="text-sm" style={{ color: "var(--gray-muted)" }}>
            {ticket.status === "closed" ? "Обращение закрыто." : "Обращение решено."} Если вопрос остался — создайте новое.
          </span>
          <button onClick={onCreateNew}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#2563eb" }}>
            <Plus size={15} /> Создать обращение
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
          {err && <div className="text-xs" style={{ color: "#dc2626" }}>{err}</div>}
          <PendingChips files={files} onRemove={(i) => setFiles((f) => f.filter((_, j) => j !== i))} />
          <div className="flex items-end gap-2 rounded-xl px-2 py-2" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
              onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); if (fileRef.current) fileRef.current.value = "" }} />
            <button onClick={() => fileRef.current?.click()} title="Прикрепить файл"
              className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
              <Paperclip size={17} />
            </button>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1} placeholder="Напишите сообщение…"
              className="flex-1 resize-none bg-transparent text-sm outline-none py-1 max-h-32"
              style={{ color: "var(--on-dark)" }} />
            <button onClick={send} disabled={(!text.trim() && !files.length) || sending}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white disabled:opacity-40 flex-shrink-0" style={{ background: "#2563eb" }}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Оценка ────────────────────────────────────────────────────────────────
function RateBlock({ ticketId, initial, onDone }: { ticketId: string; initial: number | null; onDone: () => void }) {
  const [rating, setRating] = useState(initial ?? 0)
  const [hover, setHover] = useState(0)
  const [done, setDone] = useState(initial != null)

  async function rate(v: number) {
    setRating(v); setDone(true)
    await rateTicketAction(ticketId, v)
    onDone()
  }

  return (
    <div className="mx-auto max-w-sm text-center rounded-xl px-4 py-4 mt-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{done ? "Спасибо за оценку!" : "Оцените поддержку"}</div>
      <div className="flex items-center justify-center gap-1 mt-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} disabled={done && initial != null} onMouseEnter={() => setHover(v)} onClick={() => rate(v)}>
            <Star size={26} style={{ color: (hover || rating) >= v ? "#f59e0b" : "var(--gray-muted)" }}
              fill={(hover || rating) >= v ? "#f59e0b" : "none"} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Создание обращения ──────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [category, setCategory] = useState<TicketCategory>("other")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!subject.trim()) { setErr("Укажите тему"); return }
    setBusy(true); setErr("")
    let uploaded: AttachmentInput[] = []
    if (files.length) {
      const res = await uploadFiles(files)
      if (res.error) { setErr(res.error); setBusy(false); return }
      uploaded = res.uploaded
    }
    const { id, error } = await createTicketAction({ category, subject, body, clientMeta: collectClientMeta(), attachments: uploaded })
    setBusy(false)
    if (error || !id) { setErr(error ?? "Ошибка"); return }
    onCreated(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Новое обращение</h3>
          <button onClick={onClose} className="p-1"><X size={18} style={{ color: "var(--gray-muted)" }} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Категория</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.key
                return (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: active ? "rgba(37,99,235,0.12)" : "var(--card-2)",
                      color: active ? "#2563eb" : "var(--on-dark-soft)",
                      border: active ? "1px solid rgba(37,99,235,0.4)" : "1px solid var(--border)" }}>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Тема</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Коротко о проблеме"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none"
              style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Описание</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Опишите подробнее: что делали, что пошло не так"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Вложения</label>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
              onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); if (fileRef.current) fileRef.current.value = "" }} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm transition-colors"
              style={{ background: "var(--card-2)", border: "1px dashed var(--border)", color: "var(--on-dark-soft)" }}>
              <Paperclip size={15} /> Прикрепить скриншот, видео, Excel или PDF
            </button>
            {files.length > 0 && <div className="mt-2"><PendingChips files={files} onRemove={(i) => setFiles((f) => f.filter((_, j) => j !== i))} /></div>}
          </div>
          {err && <div className="text-xs" style={{ color: "#dc2626" }}>{err}</div>}
          <p className="text-[11px]" style={{ color: "var(--gray-muted)" }}>
            К обращению автоматически приложится техническая информация (версия CRM, браузер) — она поможет нам решить вопрос быстрее.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium" style={{ color: "var(--on-dark-soft)", background: "var(--card-2)", border: "1px solid var(--border)" }}>Отмена</button>
          <button onClick={submit} disabled={busy}
            className="h-10 px-5 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 disabled:opacity-50" style={{ background: "#2563eb" }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageSquarePlus size={15} />} Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
