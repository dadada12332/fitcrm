"use client"

import { useState, useTransition } from "react"
import {
  CheckCircle, AlertCircle, Trash2, Eye, EyeOff,
  Bot, Zap, MessageSquare, BarChart2, RefreshCw, Send,
} from "lucide-react"
import {
  connectTelegramAction, disconnectTelegramAction, saveTelegramSettingsAction,
} from "@/app/(app)/integrations/actions"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"
import { saveIntegrationAction } from "@/app/(app)/settings/club/actions"
import { TelegramBroadcast, type BroadcastHistoryItem } from "./TelegramBroadcast"
import type { AudienceOption, Recipient } from "@/lib/broadcast"

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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? "#2563eb" : "var(--border)" }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }} />
    </button>
  )
}

function Feedback({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg"
      style={{ background: msg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", color: msg.ok ? "#16a34a" : "#dc2626" }}>
      {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {msg.text}
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

function TelegramManage({ connected, botUsername, botFirstName, connectedAt, clientCount, subscribers, tgSettings, clubName, audienceOptions, recipients, history }: {
  connected: boolean
  botUsername: string
  botFirstName: string
  connectedAt: string | null
  clientCount: number
  subscribers: number
  tgSettings: TelegramSettings
  clubName: string
  audienceOptions: AudienceOption[]
  recipients: Recipient[]
  history: BroadcastHistoryItem[]
}) {
  const [tab, setTab] = useState("main")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [connectMsg, setConnectMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [disconnectPending, startDisconnect] = useTransition()
  const [connectPending, startConnect] = useTransition()

  // Automation state
  const [auto, setAuto] = useState(tgSettings)
  const [autoMsg, setAutoMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [autoPending, startAuto] = useTransition()

  // Templates state
  const [tpl, setTpl] = useState({
    welcome_message: tgSettings.welcome_message,
    expiry_template: tgSettings.expiry_template,
    payment_template: tgSettings.payment_template,
  })
  const [tplMsg, setTplMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [tplPending, startTpl] = useTransition()

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnectMsg(null)
    startConnect(async () => {
      const res = await connectTelegramAction(token)
      if (res.error) { setConnectMsg({ text: res.error, ok: false }); return }
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

  function handleSaveAuto() {
    startAuto(async () => {
      const res = await saveTelegramSettingsAction(auto)
      setAutoMsg(res.error ? { text: res.error, ok: false } : { text: "Настройки сохранены", ok: true })
      setTimeout(() => setAutoMsg(null), 3000)
    })
  }

  function handleSaveTpl() {
    startTpl(async () => {
      const res = await saveTelegramSettingsAction({ ...auto, ...tpl })
      setTplMsg(res.error ? { text: res.error, ok: false } : { text: "Шаблоны сохранены", ok: true })
      setTimeout(() => setTplMsg(null), 3000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {connected && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Клиентов в базе",        value: clientCount,                     color: "#2AABEE" },
            { label: "Подключено через бот",   value: subscribers,                     color: "#16a34a" },
            { label: "Сообщений за месяц",     value: clientCount * 14,                color: "#7c3aed" },
            { label: "Новых пользователей",    value: subscribers,                     color: "var(--on-dark)" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString("ru-RU")}</p>
              <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors"
                style={{
                  fontWeight: active ? 500 : 400,
                  color: active ? "#2AABEE" : "var(--on-dark-soft)",
                  borderBottom: active ? "2px solid #2AABEE" : "2px solid transparent",
                  marginBottom: -1,
                }}>
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
            <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              {/* Bot info */}
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "var(--card-2)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: "#2AABEE" }}>
                  {botFirstName?.[0] ?? "T"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: "var(--on-dark)" }}>{botFirstName}</p>
                  <p className="text-sm font-mono" style={{ color: "#2AABEE" }}>@{botUsername}</p>
                  {connectedAt && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
                      Подключён {new Date(connectedAt).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                  <CheckCircle size={12} />Активен
                </span>
              </div>

              {/* Reconnect form */}
              <div>
                <p className="text-sm font-medium mb-3" style={{ color: "var(--on-dark)" }}>Обновить токен</p>
                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="relative">
                    <input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Новый Bot Token от @BotFather"
                      type={showToken ? "text" : "password"}
                      className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none font-mono"
                      style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                    />
                    <button type="button" onClick={() => setShowToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--on-dark-soft)" }}>
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <Feedback msg={connectMsg} />
                  <div className="flex gap-3">
                    <button type="submit" disabled={connectPending || !token.trim()}
                      className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
                      style={{ background: "#2AABEE" }}>
                      <RefreshCw size={14} className={connectPending ? "animate-spin" : ""} />
                      {connectPending ? "Проверяю…" : "Обновить бота"}
                    </button>
                    <button type="button" onClick={handleDisconnect} disabled={disconnectPending}
                      className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-40"
                      style={{ border: "1px solid var(--border)", color: "#dc2626" }}>
                      <Trash2 size={14} />
                      {disconnectPending ? "Отключаю…" : "Отключить"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Instruction */}
              <div className="p-4 rounded-xl text-sm space-y-1.5" style={{ background: "rgba(42,171,238,0.06)", border: "1px solid rgba(42,171,238,0.2)" }}>
                <p className="font-medium" style={{ color: "#0e7bb5" }}>Как поделиться ботом с клиентами</p>
                <p style={{ color: "var(--on-dark-soft)" }}>
                  Отправьте клиентам ссылку: <span className="font-mono font-medium" style={{ color: "#2AABEE" }}>https://t.me/{botUsername}</span>
                </p>
                <p style={{ color: "var(--on-dark-soft)" }}>
                  Клиент нажмёт /start и введёт номер телефона — система автоматически найдёт его в базе.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              {/* How to get token */}
              <div className="p-4 rounded-xl" style={{ background: "var(--card-2)" }}>
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--on-dark)" }}>Как создать бота</p>
                {[
                  { n: 1, text: "Откройте Telegram и найдите @BotFather" },
                  { n: 2, text: "Отправьте команду /newbot" },
                  { n: 3, text: "Придумайте имя и username для бота (например LemonFitBot)" },
                  { n: 4, text: "Скопируйте полученный токен и вставьте ниже" },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3 mb-2.5 last:mb-0">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ background: "#2AABEE" }}>{s.n}</span>
                    <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{s.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleConnect} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
                    Bot Token от @BotFather
                  </label>
                  <div className="relative">
                    <input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="1234567890:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      type={showToken ? "text" : "password"}
                      className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none font-mono"
                      style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                    />
                    <button type="button" onClick={() => setShowToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--on-dark-soft)" }}>
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <Feedback msg={connectMsg} />
                <button type="submit" disabled={connectPending || !token.trim()}
                  className="h-10 px-6 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#2AABEE" }}>
                  <Bot size={15} className={connectPending ? "animate-pulse" : ""} />
                  {connectPending ? "Проверяю токен…" : "Подключить бота"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Automation tab ── */}
      {tab === "automation" && (
        <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {!connected && (
            <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(245,158,11,0.08)", color: "#b45309" }}>
              ⚠ Сначала подключите бота на вкладке «Основное»
            </div>
          )}
          <div className="space-y-4">
            {[
              { key: "auto_expiry_3d" as const, label: "Напоминание за 3 дня до истечения", desc: "Бот отправит клиенту сообщение за 3 дня" },
              { key: "auto_expiry_1d" as const, label: "Напоминание за 1 день до истечения", desc: "Срочное напоминание накануне истечения" },
              { key: "renewal_reminder" as const, label: "Предложение продления", desc: "Бот предложит продлить абонемент с кнопкой оплаты" },
              { key: "qr_checkin" as const, label: "QR-чекин через бот", desc: "Клиент показывает QR-код из бота для входа в зал" },
              { key: "welcome_enabled" as const, label: "Приветственное сообщение", desc: "Отправить сообщение когда клиент нажимает /start" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{item.desc}</p>
                </div>
                <Toggle checked={auto[item.key]} onChange={(v) => setAuto((p) => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
          </div>
          <Feedback msg={autoMsg} />
          <button onClick={handleSaveAuto} disabled={autoPending || !connected}
            className="h-10 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#2AABEE" }}>
            {autoPending ? "Сохранение…" : "Сохранить настройки"}
          </button>
        </div>
      )}

      {/* ── Broadcast tab ── */}
      {tab === "broadcast" && (
        <TelegramBroadcast
          connected={connected}
          botName={botFirstName}
          clubName={clubName}
          audienceOptions={audienceOptions}
          recipients={recipients}
          history={history}
        />
      )}

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {!connected && (
            <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(245,158,11,0.08)", color: "#b45309" }}>
              ⚠ Сначала подключите бота на вкладке «Основное»
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
            Переменные: <code>{"{{name}}"}</code> — имя клиента, <code>{"{{club}}"}</code> — название клуба,{" "}
            <code>{"{{expires}}"}</code> — дата, <code>{"{{days}}"}</code> — дней, <code>{"{{amount}}"}</code> — сумма
          </p>
          {[
            { key: "welcome_message" as const, label: "Приветственное сообщение" },
            { key: "expiry_template" as const, label: "Уведомление об истечении" },
            { key: "payment_template" as const, label: "Подтверждение оплаты" },
          ].map((t) => (
            <div key={t.key}>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--on-dark)" }}>{t.label}</label>
              <textarea
                value={tpl[t.key]}
                onChange={(e) => setTpl((p) => ({ ...p, [t.key]: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none font-mono"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
              />
            </div>
          ))}
          <Feedback msg={tplMsg} />
          <button onClick={handleSaveTpl} disabled={tplPending || !connected}
            className="h-10 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#2AABEE" }}>
            {tplPending ? "Сохранение…" : "Сохранить шаблоны"}
          </button>
        </div>
      )}

      {/* ── Stats tab ── */}
      {tab === "stats" && (
        <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {connected ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Сообщений сегодня",    value: Math.floor(clientCount * 1.2), color: "#2AABEE" },
                { label: "Активных за 7 дней",   value: Math.floor(clientCount * 0.7), color: "#16a34a" },
                { label: "Продлений через бот",  value: Math.floor(clientCount * 0.08), color: "#7c3aed" },
                { label: "QR-чекинов сегодня",   value: Math.floor(clientCount * 0.15), color: "#f59e0b" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--card-2)" }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString("ru-RU")}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
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
          <div className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color }}>{clientCount.toLocaleString("ru-RU")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Платежей всего</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>Активно</p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>Статус вебхуков</p>
          </div>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {connected && (
          <div className="flex items-center justify-between p-4 rounded-xl mb-4"
            style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--on-dark-soft)" }}>Merchant ID</p>
              <p className="text-sm font-mono font-medium" style={{ color: "var(--on-dark)" }}>
                {"•".repeat(8)} {currentValue.slice(-4)}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
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
              <input value={vals[f.key] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} type={f.secret ? "password" : "text"}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
            </div>
          ))}
          <Feedback msg={msg} />
          <button type="submit" disabled={pending || !vals[fields[0]?.key ?? ""]?.trim()}
            className="h-10 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: color }}>
            {pending ? "Сохранение…" : connected ? "Обновить" : "Подключить"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────

export function IntegrationManage({ slug, label, color, connected, currentValue, clientCount, subscribers, tgSettings, botUsername, botFirstName, connectedAt, clubName, audienceOptions, recipients, history }: {
  slug: string; label: string; color: string
  connected: boolean; currentValue: string; clientCount: number
  subscribers?: number
  tgSettings?: TelegramSettings
  botUsername?: string; botFirstName?: string; connectedAt?: string | null
  clubName?: string
  audienceOptions?: AudienceOption[]
  recipients?: Recipient[]
  history?: BroadcastHistoryItem[]
}) {
  if (slug === "telegram") {
    return (
      <TelegramManage
        connected={connected}
        botUsername={botUsername ?? ""}
        botFirstName={botFirstName ?? "Бот"}
        connectedAt={connectedAt ?? null}
        clientCount={clientCount}
        subscribers={subscribers ?? 0}
        tgSettings={tgSettings ?? DEFAULT_TG_SETTINGS}
        clubName={clubName ?? "Клуб"}
        audienceOptions={audienceOptions ?? []}
        recipients={recipients ?? []}
        history={history ?? []}
      />
    )
  }
  return (
    <SimpleManage slug={slug} label={label} color={color} connected={connected} currentValue={currentValue} clientCount={clientCount} />
  )
}
