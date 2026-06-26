"use client"

import { useMemo, useRef, useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Send, Image as ImageIcon, X, Smile, Braces, Users, Clock, Search, CheckCircle, Calendar,
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
  const filtered = useMemo(
    () => filterByAudience(recipients, audience, [...manual]),
    [recipients, audience, manual],
  )
  const count = filtered.length

  const sample: Recipient = filtered[0] ?? {
    telegramId: 0, fullName: "Иван Иванов", membership: "PRO", membershipId: null,
    expiresAt: new Date(Date.now() + 12 * 86_400_000).toISOString(), visitsLeft: 8, status: "active", daysLeft: 12,
  }
  const previewText = personalize(message || "Текст сообщения появится здесь…", sample, clubName)

  function pickImage(file: File | null) {
    if (file && file.size > 10 * 1024 * 1024) { setResult({ ok: false, text: "Изображение больше 10 МБ" }); return }
    setImage(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current
    if (!ta) { setMessage((m) => m + text); return }
    const start = ta.selectionStart ?? message.length
    const end = ta.selectionEnd ?? message.length
    const next = message.slice(0, start) + text + message.slice(end)
    setMessage(next)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length })
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

  function reset() {
    setMessage(""); pickImage(null); if (fileRef.current) fileRef.current.value = ""
  }

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

  const busy = pending || testing
  const canSend = connected && (!!message.trim() || !!image) && !busy

  return (
    <div className="space-y-5">
      {!connected && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(245,158,11,0.08)", color: "#b45309" }}>
          ⚠ Сначала подключите бота на вкладке «Основное»
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,340px)] gap-5 items-start">
        {/* ── Форма ── */}
        <div className="space-y-4">
          {/* Получатели */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label className="block text-sm font-medium" style={{ color: "var(--on-dark)" }}>Получатели</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={fieldStyle}>
              {audienceOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>

            {audience === "manual" && (
              <ManualPicker recipients={recipients} selected={manual} onChange={setManual} />
            )}

            <div className="flex items-center gap-2 text-sm pt-1" style={{ color: "var(--on-dark-soft)" }}>
              <Users size={16} style={{ color: "#2AABEE" }} />
              Получат <span className="font-semibold" style={{ color: "var(--on-dark)" }}>{count}</span> {plural(count)}
            </div>
          </div>

          {/* Сообщение */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium" style={{ color: "var(--on-dark)" }}>Сообщение</label>
              <div className="flex items-center gap-1">
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
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="h-8 px-2.5 rounded-md text-sm flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
                  <ImageIcon size={15} />Картинка
                </button>
              </div>
            </div>

            <textarea ref={taRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={6}
              placeholder="Напишите сообщение… Используйте {{Имя}} для персонализации"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={fieldStyle} />

            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            {preview ? (
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "var(--card-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="w-14 h-14 rounded-md object-cover" />
                <span className="text-sm flex-1" style={{ color: "#16a34a" }}>Изображение добавлено</span>
                <button type="button" onClick={() => { pickImage(null); if (fileRef.current) fileRef.current.value = "" }}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700" style={{ color: "var(--on-dark-soft)" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>PNG, JPG до 10 МБ</p>
            )}
          </div>

          {/* Когда */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label className="block text-sm font-medium" style={{ color: "var(--on-dark)" }}>Когда отправить</label>
            <div className="flex gap-2">
              {([["now", "Сейчас"], ["scheduled", "Запланировать"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  className="flex-1 h-9 rounded-lg text-sm font-medium transition-colors"
                  style={mode === k ? { background: "#2AABEE", color: "white" } : { ...fieldStyle }}>
                  {l}
                </button>
              ))}
            </div>
            {mode === "scheduled" && (
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={fieldStyle} />
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-xl p-4" style={{ background: result.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" }}>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: result.ok ? "#16a34a" : "#dc2626" }}>
                {result.ok ? <CheckCircle size={16} /> : <X size={16} />}
                {result.text}
              </div>
              {result.ok && (
                <div className="h-1.5 mt-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: "100%", background: "#16a34a" }} />
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleTest} disabled={!canSend}
              className="h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
              style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}>
              <Send size={14} />{testing ? "Отправляю…" : "Отправить себе"}
            </button>
            <button type="button" onClick={handleSend} disabled={!canSend}
              className="h-10 px-6 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#2AABEE" }}>
              {mode === "scheduled" ? <Calendar size={15} /> : <Send size={15} className={pending ? "animate-pulse" : ""} />}
              {pending ? "Отправляю…" : mode === "scheduled" ? "Запланировать" : "Отправить"}
            </button>
          </div>
        </div>

        {/* ── Превью Telegram ── */}
        <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "var(--on-dark-soft)" }}>Превью в Telegram</p>
          <div className="rounded-xl p-3" style={{ background: "#cdd8e3" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "#2AABEE" }}>
                {botName?.[0] ?? "T"}
              </div>
              <span className="text-xs font-medium" style={{ color: "#0f172a" }}>{botName}</span>
            </div>
            <div className="rounded-xl rounded-tl-sm overflow-hidden shadow-sm" style={{ background: "white", maxWidth: 260 }}>
              {preview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={preview} alt="" className="w-full max-h-40 object-cover" />
              )}
              <p className="px-3 py-2 text-sm whitespace-pre-wrap break-words" style={{ color: "#0f172a" }}>{previewText}</p>
            </div>
          </div>
        </div>
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
        <Icon size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-lg p-1.5 shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
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
      <div className="max-h-48 overflow-y-auto flex flex-col">
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
