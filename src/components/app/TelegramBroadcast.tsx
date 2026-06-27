"use client"

import { useMemo, useRef, useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Send, Image as ImageIcon, X, Smile, Braces, Users, Clock, Search, CheckCircle,
  Paperclip, Mic, ChevronDown, MoreVertical, Check,
} from "lucide-react"
import {
  broadcastTelegramAction, scheduleBroadcastAction, testBroadcastAction,
} from "@/app/(app)/integrations/actions"
import {
  VARIABLES, EMOJIS, filterByAudience, personalize,
  type AudienceOption, type Recipient,
} from "@/lib/broadcast"

export type BroadcastHistoryItem = {
  id: string
  message: string | null
  imageUrl: string | null
  audienceLabel: string | null
  status: string
  scheduledAt: string | null
  sentAt: string | null
  total: number
  delivered: number
}

type Props = {
  connected: boolean
  botName: string
  clubName: string
  audienceOptions: AudienceOption[]
  recipients: Recipient[]
  history: BroadcastHistoryItem[]
}

const fieldStyle = { background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" } as const

export function TelegramBroadcast({ connected, botName, clubName, audienceOptions, recipients, history }: Props) {
  const router = useRouter()
  const [audience, setAudience] = useState("all")
  const [manual, setManual] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<"now" | "scheduled">("now")
  const [when, setWhen] = useState("")
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const [testing, startTest] = useTransition()

  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const audienceLabel = audienceOptions.find((o) => o.key === audience)?.label ?? "Всем"
  const filtered = useMemo(() => filterByAudience(recipients, audience, [...manual]), [recipients, audience, manual])
  const count = filtered.length

  const sample: Recipient = filtered[0] ?? {
    telegramId: 0, fullName: "Иван Иванов", membership: "PRO", membershipId: null,
    expiresAt: new Date(Date.now() + 12 * 86_400_000).toISOString(), visitsLeft: 8, status: "active", daysLeft: 12,
  }
  const previewText = personalize(message, sample, clubName)

  function pickImage(file: File | null) {
    if (file && file.size > 10 * 1024 * 1024) { setResult({ ok: false, text: "Изображение больше 10 МБ" }); return }
    setImage(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current
    if (!ta) { setMessage((m) => m + text); return }
    const s = ta.selectionStart ?? message.length
    const e = ta.selectionEnd ?? message.length
    setMessage(message.slice(0, s) + text + message.slice(e))
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length })
  }

  function buildForm() {
    const fd = new FormData()
    fd.append("message", message)
    if (image) fd.append("image", image)
    fd.append("audience", audience)
    fd.append("audience_label", audienceLabel)
    if (audience === "manual") fd.append("manual_ids", [...manual].join(","))
    return fd
  }
  function reset() { setMessage(""); pickImage(null); if (fileRef.current) fileRef.current.value = "" }

  function handleSend() {
    if (!message.trim() && !image) return
    if (mode === "scheduled") { handleSchedule(); return }
    if (!confirm(`Отправить пост ${count} получателям?`)) return
    setResult(null)
    start(async () => {
      const res = await broadcastTelegramAction(buildForm())
      if (res.error && !res.sent) { setResult({ ok: false, text: res.error }); return }
      setResult({ ok: true, text: `Доставлено ${res.sent} из ${res.total}${res.failed ? ` · не доставлено ${res.failed}` : ""}` })
      reset(); router.refresh()
    })
  }
  function handleSchedule() {
    if (!when) { setResult({ ok: false, text: "Укажите дату и время" }); return }
    setResult(null)
    start(async () => {
      const fd = buildForm(); fd.append("scheduled_at", when)
      const res = await scheduleBroadcastAction(fd)
      if (res.error) { setResult({ ok: false, text: res.error }); return }
      setResult({ ok: true, text: `Запланировано на ${new Date(when).toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}` })
      reset(); router.refresh()
    })
  }
  function handleTest() {
    if (!message.trim() && !image) return
    setResult(null)
    startTest(async () => {
      const res = await testBroadcastAction(buildForm())
      setResult(res.error ? { ok: false, text: res.error } : { ok: true, text: "Тест отправлен вам в Telegram" })
    })
  }

  const canSend = connected && (!!message.trim() || !!image) && !pending && !testing

  return (
    <div className="space-y-5">
      {!connected && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(245,158,11,0.08)", color: "#b45309" }}>
          ⚠ Сначала подключите бота на вкладке «Основное»
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_360px] gap-4 items-stretch" style={{ minHeight: 520 }}>
        {/* ── LEFT: настройки ── */}
        <div className="rounded-xl p-4 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-dark)" }}>Получатели</label>
            <div className="relative">
              <select value={audience} onChange={(e) => setAudience(e.target.value)}
                className="w-full h-10 pl-3 pr-9 rounded-lg text-sm outline-none appearance-none" style={fieldStyle}>
                {audienceOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
            </div>
            {audience === "manual" && <div className="mt-2"><ManualPicker recipients={recipients} selected={manual} onChange={setManual} /></div>}
            <div className="flex items-center gap-1.5 text-sm mt-2.5" style={{ color: "var(--on-dark-soft)" }}>
              <Users size={15} style={{ color: "#2AABEE" }} />
              Получат <span className="font-semibold" style={{ color: "var(--on-dark)" }}>{count}</span> {plural(count)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-dark)" }}>Когда отправить</label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: "var(--card-2)" }}>
              {([["now", "Сейчас"], ["scheduled", "Запланировать"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  className="h-9 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  style={mode === k ? { background: "var(--card)", color: "var(--on-dark)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "var(--on-dark-soft)" }}>
                  <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center" style={{ borderColor: mode === k ? "#2AABEE" : "var(--border)" }}>
                    {mode === k && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2AABEE" }} />}
                  </span>
                  {l}
                </button>
              ))}
            </div>
            {mode === "scheduled" && (
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                className="w-full h-10 px-3 mt-2 rounded-lg text-sm outline-none" style={fieldStyle} />
            )}
          </div>

          <button type="button" onClick={handleTest} disabled={!canSend}
            className="w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}>
            <Send size={14} />{testing ? "Отправляю…" : "Отправить себе"}
          </button>

          {result && (
            <div className="rounded-lg p-3" style={{ background: result.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" }}>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: result.ok ? "#16a34a" : "#dc2626" }}>
                {result.ok ? <CheckCircle size={15} /> : <X size={15} />}{result.text}
              </div>
            </div>
          )}
        </div>

        {/* ── CENTER: композер ── */}
        <div className="rounded-xl flex flex-col overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex-1 p-4">
            <textarea ref={taRef} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Напишите сообщение для подписчиков… Используйте {{Имя}} для персонализации"
              className="w-full h-full min-h-[220px] resize-none outline-none text-sm bg-transparent"
              style={{ color: "var(--on-dark)" }} />
          </div>

          {preview && (
            <div className="mx-4 mb-2 flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--card-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="w-10 h-10 rounded object-cover" />
              <span className="text-sm flex-1" style={{ color: "#16a34a" }}>Изображение добавлено</span>
              <button type="button" onClick={() => { pickImage(null); if (fileRef.current) fileRef.current.value = "" }}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700" style={{ color: "var(--on-dark-soft)" }}><X size={13} /></button>
            </div>
          )}

          {/* bottom bar */}
          <div className="flex items-center gap-1 p-3" style={{ borderTop: "1px solid var(--border)" }}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            <ToolBtn icon={Paperclip} title="Картинка" onClick={() => fileRef.current?.click()} />
            <Popover icon={Braces} title="Переменные">
              <div className="flex flex-col w-56">
                {VARIABLES.map((v) => (
                  <button key={v.token} type="button" onClick={() => insertAtCursor(v.token)}
                    className="flex items-center justify-between px-3 h-9 text-sm text-left rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark)" }}>
                    {v.label}<code className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{v.token}</code>
                  </button>
                ))}
              </div>
            </Popover>
            <Popover icon={Smile} title="Эмодзи">
              <div className="grid grid-cols-6 gap-1 w-60">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertAtCursor(e)}
                    className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg">{e}</button>
                ))}
              </div>
            </Popover>
            <Mic size={18} className="ml-1" style={{ color: "var(--gray-muted)" }} />
            <div className="flex-1" />
            <button type="button" onClick={handleSend} disabled={!canSend}
              className="h-9 px-5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--on-dark)" }}>
              {pending ? "Отправляю…" : mode === "scheduled" ? "Запланировать" : "Отправить"}
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* ── RIGHT: Telegram превью ── */}
        <TelegramPreview botName={botName} clubName={clubName} text={previewText} image={preview} />
      </div>

      {/* ── История ── */}
      <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-medium mb-3" style={{ color: "var(--on-dark)" }}>История рассылок</p>
        {history.length === 0 ? (
          <p className="text-sm py-2" style={{ color: "var(--on-dark-soft)" }}>Рассылок ещё не было</p>
        ) : (
          <div className="flex flex-col">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                {h.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={h.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                  : <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--card-2)" }}><Send size={15} style={{ color: "#2AABEE" }} /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--on-dark)" }}>{h.message || "Без текста"}</p>
                  <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                    {h.audienceLabel ?? "Всем"} · {h.status === "scheduled"
                      ? <span className="inline-flex items-center gap-1"><Clock size={11} />Запланировано на {fmtDate(h.scheduledAt)}</span>
                      : fmtDate(h.sentAt)}
                  </p>
                </div>
                {h.status !== "scheduled" && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>{h.delivered}</p>
                    <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>доставлено</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Telegram-превью (тёмный реалистичный интерфейс) ── */
function TelegramPreview({ botName, clubName, text, image }: { botName: string; clubName: string; text: string; image: string | null }) {
  const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "#0e1621", border: "1px solid var(--border)" }}>
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: "#17212b" }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "#2AABEE" }}>
          {(botName || "F")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-white">{botName || "FITCRM"}</p>
          <p className="text-xs" style={{ color: "#6ab7ff" }}>бот</p>
        </div>
        <Search size={17} style={{ color: "#7d8e9e" }} />
        <MoreVertical size={17} style={{ color: "#7d8e9e" }} />
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
        style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(42,171,238,0.06), transparent 60%)" }}>
        {/* sample bot message для реализма */}
        <Bubble time={time}>
          <p className="text-sm" style={{ color: "#e7eef5" }}>👋 Это бот клуба «{clubName}». Здесь появятся ваши рассылки.</p>
        </Bubble>

        {/* реальный пост-превью */}
        <Bubble time={time} highlight image={image}>
          <p className="text-sm whitespace-pre-wrap break-words" style={{ color: "#e7eef5" }}>
            {text || "Текст сообщения появится здесь…"}
          </p>
        </Bubble>
      </div>
    </div>
  )
}

function Bubble({ children, time, highlight, image }: { children: React.ReactNode; time: string; highlight?: boolean; image?: string | null }) {
  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-md overflow-hidden shadow-sm"
      style={{ background: highlight ? "#2b5278" : "#182533" }}>
      {image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={image} alt="" className="w-full max-h-44 object-cover" />
      )}
      <div className="px-3 py-2">
        {children}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px]" style={{ color: "#8aa6c0" }}>{time}</span>
          <Check size={12} style={{ color: "#6ab7ff" }} />
        </div>
      </div>
    </div>
  )
}

function ToolBtn({ icon: Icon, title, onClick }: { icon: typeof Smile; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
      <Icon size={18} />
    </button>
  )
}

function plural(n: number) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return "клиент"
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "клиента"
  return "клиентов"
}
function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function Popover({ icon: Icon, title, children }: { icon: typeof Smile; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" title={title} onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
        <Icon size={18} />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-50 rounded-lg p-1.5 shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ManualPicker({ recipients, selected, onChange }: { recipients: Recipient[]; selected: Set<number>; onChange: (s: Set<number>) => void }) {
  const [q, setQ] = useState("")
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? recipients.filter((r) => r.fullName.toLowerCase().includes(t)) : recipients
  }, [recipients, q])
  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }
  return (
    <div className="rounded-lg p-2" style={{ border: "1px solid var(--border)" }}>
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--on-dark-soft)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск клиента"
          className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none" style={fieldStyle} />
      </div>
      <div className="max-h-40 overflow-y-auto flex flex-col">
        {list.length === 0 ? (
          <p className="text-sm py-2 text-center" style={{ color: "var(--on-dark-soft)" }}>Никого нет</p>
        ) : list.map((r) => (
          <label key={r.telegramId} className="flex items-center gap-2.5 py-1.5 px-1 cursor-pointer text-sm" style={{ color: "var(--on-dark)" }}>
            <input type="checkbox" checked={selected.has(r.telegramId)} onChange={() => toggle(r.telegramId)} />
            {r.fullName}
          </label>
        ))}
      </div>
    </div>
  )
}
