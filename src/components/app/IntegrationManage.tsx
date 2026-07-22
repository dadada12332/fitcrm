"use client"

import Image from "next/image"
import { useRef, useState, useTransition } from "react"
import {
  CheckCircle, AlertCircle, Trash2, Eye, EyeOff,
  Bot, Zap, MessageSquare, BarChart2, RefreshCw, Send, ImagePlus,
  Users, Activity, UserPlus, QrCode, type LucideIcon,
} from "lucide-react"
import {
  connectTelegramAction, disconnectTelegramAction, removeTelegramBotAvatarAction,
  saveTelegramSettingsAction, uploadTelegramBotAvatarAction,
} from "@/app/(app)/integrations/actions"
import { showActionError } from "@/lib/plan-limit-client"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"
import { saveIntegrationAction } from "@/app/(app)/settings/club/actions"
import { TelegramBroadcast, type BroadcastHistoryItem } from "./TelegramBroadcast"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { AudienceOption, Recipient } from "@/lib/broadcast"
import { TelegramTemplatesEditor, type TelegramTemplateKey } from "./TelegramTemplatesEditor"

// ── Simple integrations (Click / Payme) ──────────────────────────

const SIMPLE_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  click: [
    { key: "merchant_id", label: "Merchant ID", placeholder: "12345" },
    { key: "secret_key",  label: "Secret Key",  placeholder: "Секретный ключ", secret: true },
  ],
  payme: [
    { key: "merchant_id", label: "Merchant ID", placeholder: "merchant_id" },
    { key: "key",         label: "Key",          placeholder: "Секретный ключ", secret: true },
  ],
}

function Feedback({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
      {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {msg.text}
    </div>
  )
}

function TelegramMetricGrid({
  metrics,
  columns = "four",
}: {
  metrics: Array<{ label: string; value: number; icon: LucideIcon }>
  columns?: "two" | "four"
}) {
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border p-px ${columns === "four" ? "lg:grid-cols-4" : ""}`}>
      {metrics.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex min-w-0 flex-col gap-3 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm leading-5 text-muted-foreground">{label}</span>
            <Icon className="size-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {value.toLocaleString("ru-RU")}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Telegram management ──────────────────────────────────────────

const TABS = [
  { id: "main",       label: "Основное",      icon: Bot },
  { id: "automation", label: "Автоматизация",  icon: Zap },
  { id: "broadcast",  label: "Рассылка",       icon: Send },
  { id: "templates",  label: "Шаблоны",        icon: MessageSquare },
  { id: "stats",      label: "Статистика",     icon: BarChart2 },
]

export type TelegramStats = {
  messagesMonth: number
  activeUsers7d: number
  newUsersMonth: number
  qrCheckinsToday: number
  failedMonth: number
}

function TelegramManage({ connected, botUsername, botFirstName, botAvatarUrl, connectedAt, webhookReady, clientCount, subscribers, telegramStats, tgSettings, clubName, audienceOptions, recipients, history, automationEnabled, broadcastsEnabled }: {
  connected: boolean
  botUsername: string
  botFirstName: string
  botAvatarUrl: string
  connectedAt: string | null
  webhookReady: boolean
  clientCount: number
  subscribers: number
  telegramStats: TelegramStats
  tgSettings: TelegramSettings
  clubName: string
  audienceOptions: AudienceOption[]
  recipients: Recipient[]
  history: BroadcastHistoryItem[]
  automationEnabled: boolean
  broadcastsEnabled: boolean
}) {
  const [tab, setTab] = useState("main")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [connectMsg, setConnectMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [disconnectPending, startDisconnect] = useTransition()
  const [connectPending, startConnect] = useTransition()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState(botAvatarUrl)
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [avatarPending, startAvatar] = useTransition()

  // Automation and templates share one state so saving either tab never restores stale values.
  const [settings, setSettings] = useState(tgSettings)
  const [autoMsg, setAutoMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [autoPending, startAuto] = useTransition()

  const [savedTemplates, setSavedTemplates] = useState({
    welcome_message: tgSettings.welcome_message,
    expiry_template: tgSettings.expiry_template,
    payment_template: tgSettings.payment_template,
  })
  const [tplMsg, setTplMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [tplPending, startTpl] = useTransition()
  const availableTabs = TABS.filter((item) =>
    (item.id !== "automation" || automationEnabled) &&
    (item.id !== "broadcast" || broadcastsEnabled),
  )

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnectMsg(null)
    startConnect(async () => {
      const res = await connectTelegramAction(token)
      if (res.error) { setConnectMsg({ text: res.error, ok: false }); showActionError(res.error); return }
      setConnectMsg({ text: `Бот @${res.bot?.username} успешно подключён!`, ok: true })
      setToken("")
    })
  }

  function handleDisconnect() {
    if (!confirm("Отключить Telegram бота? Все уведомления перестанут работать.")) return
    startDisconnect(async () => {
      await disconnectTelegramAction()
    })
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0]
    event.target.value = ""
    if (!image) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      setAvatarMsg({ text: "Поддерживаются JPG, PNG и WebP", ok: false })
      return
    }
    if (image.size > 5 * 1024 * 1024) {
      setAvatarMsg({ text: "Файл должен быть не больше 5 МБ", ok: false })
      return
    }

    setAvatarMsg(null)
    startAvatar(async () => {
      const formData = new FormData()
      formData.set("avatar", image)
      const res = await uploadTelegramBotAvatarAction(formData)
      if (res.error) {
        setAvatarMsg({ text: res.error, ok: false })
        return
      }
      if (res.url) setAvatarUrl(res.url)
      setAvatarMsg({ text: res.warning ?? "Аватар бота обновлён", ok: true })
    })
  }

  function handleAvatarRemove() {
    if (!confirm("Удалить аватар Telegram-бота?")) return
    setAvatarMsg(null)
    startAvatar(async () => {
      const res = await removeTelegramBotAvatarAction()
      if (res.error) {
        setAvatarMsg({ text: res.error, ok: false })
        return
      }
      setAvatarUrl("")
      setAvatarMsg({ text: res.warning ?? "Аватар бота удалён", ok: true })
    })
  }

  function handleSaveAuto() {
    startAuto(async () => {
      const res = await saveTelegramSettingsAction(settings)
      setAutoMsg(res.error ? { text: res.error, ok: false } : { text: "Настройки сохранены", ok: true })
      setTimeout(() => setAutoMsg(null), 3000)
    })
  }

  function handleSaveTpl() {
    startTpl(async () => {
      const res = await saveTelegramSettingsAction(settings)
      if (!res.error) {
        setSavedTemplates({
          welcome_message: settings.welcome_message,
          expiry_template: settings.expiry_template,
          payment_template: settings.payment_template,
        })
      }
      setTplMsg(res.error ? { text: res.error, ok: false } : { text: "Шаблоны сохранены", ok: true })
      setTimeout(() => setTplMsg(null), 3000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {connected && (
        <TelegramMetricGrid metrics={[
          { label: "Клиентов в базе", value: clientCount, icon: Users },
          { label: "Подключено к боту", value: subscribers, icon: Bot },
          { label: "Доставлено за месяц", value: telegramStats.messagesMonth, icon: Send },
          { label: "Активны за 7 дней", value: telegramStats.activeUsers7d, icon: Activity },
        ]} />
      )}

      {/* Tabs */}
      <div className="overflow-x-auto border-b border-border">
        <nav className="flex min-w-max gap-1">
          {availableTabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors ${active ? "border-brand font-medium text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Main tab ── */}
      {tab === "main" && (
        <div className="space-y-4">
          {connected ? (
            <div className="space-y-4 rounded-lg border border-border bg-card p-5">
              {/* Bot info */}
              <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                <div className="relative flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-base font-bold text-white">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={`Аватар ${botFirstName}`} fill sizes="40px" unoptimized className="object-cover" />
                  ) : botFirstName?.[0] ?? "T"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{botFirstName}</p>
                  <p className="font-mono text-sm text-brand">@{botUsername}</p>
                  {connectedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Подключён {new Date(connectedAt).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </div>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${webhookReady ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}>
                  {webhookReady ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {webhookReady ? "Webhook активен" : "Переподключите"}
                </span>
              </div>

              {/* Bot avatar */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-xl font-bold text-white ring-4 ring-muted">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={`Аватар ${botFirstName}`} fill sizes="64px" unoptimized className="object-cover" />
                    ) : botFirstName?.[0] ?? "T"}
                    {avatarPending && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-foreground">
                        <RefreshCw size={18} className="animate-spin" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Аватар бота</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      JPG, PNG или WebP до 5 МБ. CRM обрежет фото до квадрата и обновит его в Telegram.
                    </p>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      disabled={avatarPending}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <ImagePlus size={15} />
                      {avatarUrl ? "Заменить" : "Загрузить"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Удалить аватар"
                        aria-label="Удалить аватар"
                        disabled={avatarPending}
                        onClick={handleAvatarRemove}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </div>
                {avatarMsg && <div className="mt-3"><Feedback msg={avatarMsg} /></div>}
              </div>

              {/* Reconnect form */}
              <div>
                <p className="text-sm font-medium mb-3" style={{ color: "var(--on-dark)" }}>Обновить токен</p>
                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="relative">
                    <Input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Новый Bot Token от @BotFather"
                      type={showToken ? "text" : "password"}
                      className="h-9 rounded-md px-3 pr-10 font-mono"
                    />
                    <button type="button" onClick={() => setShowToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--on-dark-soft)" }}>
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <Feedback msg={connectMsg} />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" size="lg" disabled={connectPending || !token.trim()}>
                      <RefreshCw size={14} className={connectPending ? "animate-spin" : ""} />
                      {connectPending ? "Проверяю…" : "Обновить бота"}
                    </Button>
                    <Button type="button" variant="destructive" size="lg" onClick={handleDisconnect} disabled={disconnectPending}>
                      <Trash2 size={14} />
                      {disconnectPending ? "Отключаю…" : "Отключить"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Instruction */}
              <div className="space-y-1.5 rounded-lg border border-brand/20 bg-brand/10 p-4 text-sm">
                <p className="font-medium text-brand">Как поделиться ботом с клиентами</p>
                <p className="text-muted-foreground">
                  Отправьте клиентам ссылку: <span className="font-mono font-medium text-brand">https://t.me/{botUsername}</span>
                </p>
                <p className="text-muted-foreground">
                  Клиент нажмёт /start и безопасно поделится своим номером — система найдёт его только в базе этого клуба.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 rounded-lg border border-border bg-card p-5">
              {/* How to get token */}
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Как создать бота</p>
                {[
                  { n: 1, text: "Откройте Telegram и найдите @BotFather" },
                  { n: 2, text: "Отправьте команду /newbot" },
                  { n: 3, text: "Придумайте имя и username для бота (например LemonFitBot)" },
                  { n: 4, text: "Скопируйте полученный токен и вставьте ниже" },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3 mb-2.5 last:mb-0">
                    <span className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{s.n}</span>
                    <p className="text-sm text-muted-foreground">{s.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleConnect} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
                    Bot Token от @BotFather
                  </label>
                  <div className="relative">
                    <Input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      type={showToken ? "text" : "password"}
                      className="h-9 rounded-md px-3 pr-10 font-mono"
                    />
                    <button type="button" onClick={() => setShowToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--on-dark-soft)" }}>
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <Feedback msg={connectMsg} />
                <Button type="submit" size="lg" disabled={connectPending || !token.trim()}>
                  <Bot size={15} className={connectPending ? "animate-pulse" : ""} />
                  {connectPending ? "Проверяю токен…" : "Подключить бота"}
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Automation tab ── */}
      {tab === "automation" && (
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          {!connected && (
            <div className="rounded-lg bg-chart-3/10 p-3 text-sm text-chart-3">
              Сначала подключите бота на вкладке «Основное»
            </div>
          )}
          <div className="space-y-4">
            {[
              { key: "auto_expiry_3d" as const, label: "Напоминание за 3 дня до истечения", desc: "Бот отправит клиенту сообщение за 3 дня" },
              { key: "auto_expiry_1d" as const, label: "Напоминание за 1 день до истечения", desc: "Срочное напоминание накануне истечения" },
              { key: "renewal_reminder" as const, label: "Предложение продления", desc: "Добавить к напоминанию быстрый переход к абонементу" },
              { key: "class_reminders" as const, label: "Напоминания о занятиях", desc: "Утром отправить клиенту его записи на сегодня" },
              { key: "qr_checkin" as const, label: "QR-чекин через бот", desc: "Клиент показывает QR-код из бота для входа в зал" },
              { key: "welcome_enabled" as const, label: "Приветственное сообщение", desc: "Отправить сообщение когда клиент нажимает /start" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={settings[item.key]} onCheckedChange={(v) => setSettings((p) => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
          </div>
          <Feedback msg={autoMsg} />
          <Button onClick={handleSaveAuto} size="lg" disabled={autoPending || !connected}>
            {autoPending ? "Сохранение…" : "Сохранить настройки"}
          </Button>
        </div>
      )}

      {/* ── Broadcast tab ── */}
      {tab === "broadcast" && (
        <TelegramBroadcast
          connected={connected}
          botDisplayName={botFirstName}
          botUsername={botUsername}
          clubName={clubName}
          audienceOptions={audienceOptions}
          recipients={recipients}
          history={history}
        />
      )}

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="space-y-3">
          <TelegramTemplatesEditor
            values={{
              welcome_message: settings.welcome_message,
              expiry_template: settings.expiry_template,
              payment_template: settings.payment_template,
            }}
            savedValues={savedTemplates}
            connected={connected}
            pending={tplPending}
            clubName={clubName}
            onChange={(key: TelegramTemplateKey, value: string) => setSettings((current) => ({ ...current, [key]: value }))}
            onSave={handleSaveTpl}
          />
          <Feedback msg={tplMsg} />
        </div>
      )}

      {/* ── Stats tab ── */}
      {tab === "stats" && (
        <div>
          {connected ? (
            <div className="space-y-3">
              <TelegramMetricGrid columns="two" metrics={[
                { label: "Доставлено за месяц", value: telegramStats.messagesMonth, icon: Send },
                { label: "Активных за 7 дней", value: telegramStats.activeUsers7d, icon: Activity },
                { label: "Новых подключений", value: telegramStats.newUsersMonth, icon: UserPlus },
                { label: "QR-чекинов сегодня", value: telegramStats.qrCheckinsToday, icon: QrCode },
              ]} />
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                <span className="text-muted-foreground">Ошибок доставки за месяц</span>
                <span className={telegramStats.failedMonth ? "font-semibold text-destructive" : "font-semibold text-foreground"}>{telegramStats.failedMonth}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card py-8 text-center">
              <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
                Статистика будет доступна после подключения бота
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Simple integration (Click / Payme) ──────────────────────────

function SimpleManage({ slug, label, color, connected, currentValue, clientCount }: {
  slug: string; label: string; color: string
  connected: boolean; currentValue: string; clientCount: number
}) {
  const fields = SIMPLE_FIELDS[slug] ?? []
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, start] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    const value = vals[fields[0]?.key ?? ""] ?? ""
    if (!value.trim()) return
    start(async () => {
      const res = await saveIntegrationAction(slug, value.trim())
      setMsg(res.error ? { text: res.error, ok: false } : { text: "Сохранено!", ok: true })
      setTimeout(() => setMsg(null), 3000)
    })
  }

  return (
    <div className="space-y-4">
      {connected && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color }}>{clientCount.toLocaleString("ru-RU")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Платежей всего</p>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold text-chart-2">Активно</p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Статус вебхуков</p>
          </div>
        </div>
      )}

      <div className="rounded-lg p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {connected && (
          <div className="flex items-center justify-between p-4 rounded-lg mb-4"
            style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--on-dark-soft)" }}>Merchant ID</p>
              <p className="text-sm font-mono font-medium" style={{ color: "var(--on-dark)" }}>
                {"•".repeat(8)} {currentValue.slice(-4)}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-chart-2/10 px-2.5 py-1 text-xs font-medium text-chart-2">
              <CheckCircle size={12} />Активно
            </span>
          </div>
        )}

        <p className="text-sm font-medium mb-3" style={{ color: "var(--on-dark)" }}>
          {connected ? `Обновить настройки ${label}` : `Подключить ${label}`}
        </p>
        <form onSubmit={handleSave} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>{f.label}</label>
              <Input value={vals[f.key] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} type={f.secret ? "password" : "text"}
                className="h-9 rounded-md px-3" />
            </div>
          ))}
          <Feedback msg={msg} />
          <button type="submit" disabled={pending || !vals[fields[0]?.key ?? ""]?.trim()}
            className="h-9 px-4 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: color }}>
            {pending ? "Сохранение…" : connected ? "Обновить" : "Подключить"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────

export function IntegrationManage({ slug, label, color, connected, currentValue, clientCount, subscribers, tgSettings, botUsername, botFirstName, botAvatarUrl, connectedAt, webhookReady, telegramStats, clubName, audienceOptions, recipients, history, automationEnabled = true, broadcastsEnabled = true }: {
  slug: string; label: string; color: string
  connected: boolean; currentValue: string; clientCount: number
  subscribers?: number
  tgSettings?: TelegramSettings
  botUsername?: string; botFirstName?: string; botAvatarUrl?: string; connectedAt?: string | null
  webhookReady?: boolean
  telegramStats?: TelegramStats
  clubName?: string
  audienceOptions?: AudienceOption[]
  recipients?: Recipient[]
  history?: BroadcastHistoryItem[]
  automationEnabled?: boolean
  broadcastsEnabled?: boolean
}) {
  if (slug === "telegram") {
    return (
      <TelegramManage
        connected={connected}
        botUsername={botUsername ?? ""}
        botFirstName={botFirstName ?? "Бот"}
        botAvatarUrl={botAvatarUrl ?? ""}
        connectedAt={connectedAt ?? null}
        webhookReady={webhookReady ?? false}
        clientCount={clientCount}
        subscribers={subscribers ?? 0}
        telegramStats={telegramStats ?? { messagesMonth: 0, activeUsers7d: 0, newUsersMonth: 0, qrCheckinsToday: 0, failedMonth: 0 }}
        tgSettings={tgSettings ?? DEFAULT_TG_SETTINGS}
        clubName={clubName ?? "Клуб"}
        audienceOptions={audienceOptions ?? []}
        recipients={recipients ?? []}
        history={history ?? []}
        automationEnabled={automationEnabled}
        broadcastsEnabled={broadcastsEnabled}
      />
    )
  }
  return (
    <SimpleManage slug={slug} label={label} color={color} connected={connected} currentValue={currentValue} clientCount={clientCount} />
  )
}
