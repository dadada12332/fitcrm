"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Braces,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  ImageIcon,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
  Users,
  X,
} from "lucide-react"
import {
  broadcastTelegramAction,
  createTelegramStaffPairingAction,
  scheduleBroadcastAction,
  testBroadcastAction,
} from "@/app/(app)/integrations/actions"
import {
  EMOJIS,
  VARIABLES,
  filterByAudience,
  personalize,
  type AudienceOption,
  type Recipient,
} from "@/lib/broadcast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { showActionError } from "@/lib/plan-limit-client"

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
  botDisplayName: string
  botUsername: string
  clubName: string
  audienceOptions: AudienceOption[]
  recipients: Recipient[]
  history: BroadcastHistoryItem[]
}

export function TelegramBroadcast({
  connected,
  botDisplayName,
  botUsername,
  clubName,
  audienceOptions,
  recipients,
  history,
}: Props) {
  const router = useRouter()
  const [audience, setAudience] = useState("all")
  const [manual, setManual] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<"now" | "scheduled">("now")
  const [when, setWhen] = useState("")
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pairingUrl, setPairingUrl] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [testing, startTest] = useTransition()
  const [pairing, startPairing] = useTransition()

  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const audienceLabel = audienceOptions.find((option) => option.key === audience)?.label ?? "Всем"
  const filtered = useMemo(
    () => filterByAudience(recipients, audience, [...manual]),
    [recipients, audience, manual],
  )
  const count = filtered.length
  const sample: Recipient = filtered[0] ?? {
    telegramId: 0,
    fullName: "Иван Иванов",
    membership: "PRO",
    membershipId: null,
    expiresAt: null,
    visitsLeft: 8,
    status: "active",
    daysLeft: null,
  }
  const previewText = personalize(message, sample, clubName)
  const messageLimit = image ? 1024 : 4096
  const messageTooLong = message.length > messageLimit

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function pickImage(file: File | null) {
    if (file && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setResult({ ok: false, text: "Поддерживаются JPG, PNG, WebP и GIF" })
      return
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setResult({ ok: false, text: "Изображение должно быть не больше 8 МБ" })
      return
    }
    setImage(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function insertAtCursor(text: string) {
    const textarea = taRef.current
    if (!textarea) {
      setMessage((current) => current + text)
      return
    }
    const start = textarea.selectionStart ?? message.length
    const end = textarea.selectionEnd ?? message.length
    setMessage(message.slice(0, start) + text + message.slice(end))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + text.length
    })
  }

  function buildForm() {
    const formData = new FormData()
    formData.append("message", message)
    if (image) formData.append("image", image)
    formData.append("audience", audience)
    formData.append("audience_label", audienceLabel)
    if (audience === "manual") formData.append("manual_ids", [...manual].join(","))
    return formData
  }

  function reset() {
    setMessage("")
    pickImage(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  function handleSend() {
    if (!message.trim() && !image) return
    if (mode === "scheduled") {
      handleSchedule()
      return
    }
    if (!confirm(`Отправить сообщение ${count} получателям?`)) return
    setResult(null)
    start(async () => {
      const response = await broadcastTelegramAction(buildForm())
      if (response.error && !response.sent) {
        setResult({ ok: false, text: response.error })
        showActionError(response.error)
        return
      }
      setResult({
        ok: true,
        text: `Доставлено ${response.sent} из ${response.total}${response.failed ? ` · не доставлено ${response.failed}` : ""}`,
      })
      reset()
      router.refresh()
    })
  }

  function handleSchedule() {
    if (!when) {
      setResult({ ok: false, text: "Укажите дату и время" })
      return
    }
    setResult(null)
    start(async () => {
      const formData = buildForm()
      formData.append("scheduled_at", when)
      const response = await scheduleBroadcastAction(formData)
      if (response.error) {
        setResult({ ok: false, text: response.error })
        showActionError(response.error)
        return
      }
      setResult({
        ok: true,
        text: `Запланировано на ${new Date(when).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      })
      reset()
      router.refresh()
    })
  }

  function handleTest() {
    if (!message.trim() && !image) return
    setResult(null)
    startTest(async () => {
      const response = await testBroadcastAction(buildForm())
      if (response.error) showActionError(response.error)
      setPairingUrl(response.pairingUrl ?? null)
      setResult(response.error
        ? { ok: false, text: response.error }
        : { ok: true, text: "Тест отправлен вам в Telegram" })
    })
  }

  function handlePairing() {
    setResult(null)
    startPairing(async () => {
      const response = await createTelegramStaffPairingAction()
      setPairingUrl(response.pairingUrl ?? null)
      setResult(response.error
        ? { ok: false, text: response.error }
        : { ok: true, text: "Одноразовая ссылка готова. Откройте её и нажмите Start в Telegram." })
    })
  }

  const canCompose = connected && (!!message.trim() || !!image) && !messageTooLong && !pending && !testing
  const canBroadcast = canCompose && count > 0

  return (
    <div className="space-y-4">
      {!connected && (
        <div className="flex items-start gap-3 rounded-lg border border-chart-3/20 bg-chart-3/10 p-4 text-sm text-foreground">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0 text-chart-3" />
          <div>
            <p className="font-medium">Telegram-бот не подключён</p>
            <p className="mt-0.5 text-muted-foreground">Подключите его на вкладке «Основное», чтобы отправлять сообщения.</p>
          </div>
        </div>
      )}

      {connected && recipients.length === 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand/20 bg-brand/5 p-4 text-sm text-foreground sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">В боте пока нет клиентов</p>
            <p className="mt-1 leading-5 text-muted-foreground">
              Привяжите свой Telegram для тестовой отправки или поделитесь ссылкой{` `}
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand hover:underline"
              >
                t.me/{botUsername}
              </a>
              .
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handlePairing} disabled={pairing} className="shrink-0">
            {pairing ? "Создаю ссылку…" : "Привязать мой Telegram"}
          </Button>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Новая рассылка</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Сообщение клиентам вашего клуба</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" />
              {count.toLocaleString("ru-RU")} {plural(count)}
            </span>
          </header>

          <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <label htmlFor="broadcast-audience" className="mb-1.5 block text-sm font-medium text-foreground">Получатели</label>
              <div className="relative">
                <select
                  id="broadcast-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  className="h-9 w-full appearance-none rounded-md border border-border bg-muted px-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground">Отправка</span>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                {([ ["now", "Сейчас"], ["scheduled", "По времени"] ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className={`h-7 rounded text-xs font-medium transition-colors ${
                      mode === key
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {audience === "manual" && (
              <div className="sm:col-span-2">
                <ManualPicker recipients={recipients} selected={manual} onChange={setManual} />
              </div>
            )}

            {mode === "scheduled" && (
              <div className="sm:col-span-2">
                <label htmlFor="broadcast-time" className="mb-1.5 block text-sm font-medium text-foreground">Дата и время</label>
                <input
                  id="broadcast-time"
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="broadcast-message" className="text-sm font-medium text-foreground">Сообщение</label>
              <span className={`text-xs tabular-nums ${messageTooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                {message.length.toLocaleString("ru-RU")} / {messageLimit.toLocaleString("ru-RU")}
              </span>
            </div>

            <div className={`overflow-hidden rounded-lg border bg-background transition-colors ${messageTooLong ? "border-destructive" : "border-border focus-within:border-ring"}`}>
              <Textarea
                id="broadcast-message"
                ref={taRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Напишите сообщение…"
                aria-invalid={messageTooLong}
                className="min-h-[260px] resize-none rounded-none border-0 px-4 py-3 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />

              {preview && (
                <div className="mx-3 mb-3 flex items-center gap-3 rounded-md bg-muted p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Изображение рассылки" className="size-10 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{image?.name}</p>
                    <p className="text-xs text-muted-foreground">{image ? formatBytes(image.size) : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      pickImage(null)
                      if (fileRef.current) fileRef.current.value = ""
                    }}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                    title="Удалить изображение"
                    aria-label="Удалить изображение"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 border-t border-border bg-muted/40 p-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
                />
                <ToolBtn icon={Paperclip} title="Добавить изображение" onClick={() => fileRef.current?.click()} />
                <Popover icon={Braces} title="Добавить переменную">
                  <div className="flex w-60 flex-col">
                    {VARIABLES.map((variable) => (
                      <button
                        key={variable.token}
                        type="button"
                        onClick={() => insertAtCursor(variable.token)}
                        className="flex h-9 items-center justify-between rounded-md px-3 text-left text-sm text-foreground hover:bg-muted"
                      >
                        {variable.label}
                        <code className="text-xs text-muted-foreground">{variable.token}</code>
                      </button>
                    ))}
                  </div>
                </Popover>
                <Popover icon={Smile} title="Добавить эмодзи">
                  <div className="grid w-60 grid-cols-6 gap-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertAtCursor(emoji)}
                        className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </Popover>
              </div>
            </div>

            {messageTooLong && (
              <p className="mt-2 text-xs text-destructive">
                {image ? "Подпись к изображению ограничена 1024 символами." : "Telegram принимает до 4096 символов в одном сообщении."}
              </p>
            )}

            {result && (
              <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${result.ok ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
                {result.ok ? <CheckCircle className="mt-0.5 size-4 flex-shrink-0" /> : <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />}
                <span>{result.text}</span>
              </div>
            )}

            {pairingUrl && (
              <a href={pairingUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "mt-3" })}>
                Открыть бота и привязать
              </a>
            )}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Button variant="outline" onClick={handleTest} disabled={!canCompose} className="sm:w-auto">
              <Send className="size-4" />
              {testing ? "Отправляю…" : "Отправить себе"}
            </Button>
            <Button onClick={handleSend} disabled={!canBroadcast} className="sm:min-w-36">
              {pending ? "Отправляю…" : mode === "scheduled" ? "Запланировать" : count > 0 ? `Отправить · ${count}` : "Отправить"}
              <Send className="size-4" />
            </Button>
          </footer>
        </section>

        <aside className="overflow-hidden rounded-lg border border-border bg-card xl:sticky xl:top-4">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Предпросмотр</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sample.fullName}</p>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Telegram</span>
          </div>
          <TelegramPreview botName={botDisplayName} clubName={clubName} text={previewText} image={preview} />
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">История рассылок</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Последние отправленные и запланированные сообщения</p>
          </div>
          {history.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{history.length}</span>}
        </header>

        {history.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Send className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">Рассылок ещё не было</p>
            <p className="mt-1 text-xs text-muted-foreground">Отправленные сообщения появятся здесь.</p>
          </div>
        ) : (
          <div>
            {history.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${index > 0 ? "border-t border-border" : ""}`}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="size-10 flex-shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.message || "Без текста"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>{item.audienceLabel ?? "Всем"}</span>
                    <span>·</span>
                    {item.status === "scheduled" ? (
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />Запланировано на {fmtDate(item.scheduledAt)}</span>
                    ) : (
                      <span>{fmtDate(item.sentAt)}</span>
                    )}
                  </p>
                </div>
                {item.status !== "scheduled" && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{item.delivered}</p>
                    <p className="text-xs text-muted-foreground">доставлено</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TelegramPreview({
  botName,
  clubName,
  text,
  image,
}: {
  botName: string
  clubName: string
  text: string
  image: string | null
}) {
  const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  return (
    <div className="flex min-h-[430px] flex-col bg-muted">
      <div className="flex items-center gap-2.5 border-b border-border bg-card px-3 py-2.5">
        <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
          {(botName || "F")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{botName || "fitCRM"}</p>
          <p className="text-xs text-muted-foreground">бот</p>
        </div>
        <Search className="size-4 text-muted-foreground" />
        <MoreVertical className="size-4 text-muted-foreground" />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <Bubble time={time}>
          <p className="text-sm">Это бот клуба «{clubName}». Здесь появятся ваши рассылки.</p>
        </Bubble>
        <Bubble time={time} highlight image={image}>
          <p className="whitespace-pre-wrap break-words text-sm">
            {text || "Текст сообщения появится здесь…"}
          </p>
        </Bubble>
      </div>
    </div>
  )
}

function Bubble({
  children,
  time,
  highlight,
  image,
}: {
  children: React.ReactNode
  time: string
  highlight?: boolean
  image?: string | null
}) {
  return (
    <div className={`max-w-[88%] overflow-hidden rounded-lg border shadow-xs ${
      highlight
        ? "border-brand bg-brand text-white"
        : "border-border bg-card text-foreground"
    }`}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Изображение рассылки" className="max-h-44 w-full object-cover" />
      )}
      <div className="px-3 py-2">
        {children}
        <div className={`mt-1 flex items-center justify-end gap-1 ${highlight ? "text-white/70" : "text-muted-foreground"}`}>
          <span className="text-[10px]">{time}</span>
          <Check className="size-3" />
        </div>
      </div>
    </div>
  )
}

function ToolBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Smile
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

function Popover({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Smile
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <Icon className="size-[18px]" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {children}
        </div>
      )}
    </div>
  )
}

function ManualPicker({
  recipients,
  selected,
  onChange,
}: {
  recipients: Recipient[]
  selected: Set<number>
  onChange: (selected: Set<number>) => void
}) {
  const [query, setQuery] = useState("")
  const list = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? recipients.filter((recipient) => recipient.fullName.toLowerCase().includes(term)) : recipients
  }, [recipients, query])

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск клиента"
          className="h-9 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex max-h-40 flex-col overflow-y-auto">
        {list.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Никого нет</p>
        ) : list.map((recipient) => (
          <label key={recipient.telegramId} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-foreground hover:bg-muted">
            <input
              type="checkbox"
              checked={selected.has(recipient.telegramId)}
              onChange={() => toggle(recipient.telegramId)}
              className="accent-primary"
            />
            {recipient.fullName}
          </label>
        ))}
      </div>
    </div>
  )
}

function plural(value: number) {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return "клиент"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "клиента"
  return "клиентов"
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
