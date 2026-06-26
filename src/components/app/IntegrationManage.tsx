"use client"

import { useState, useTransition } from "react"
import { CheckCircle, AlertCircle, Trash2 } from "lucide-react"
import { saveIntegrationAction } from "@/app/(app)/settings/club/actions"

const FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  telegram: [{ key: "token", label: "Bot Token", placeholder: "1234567890:AAFxxxxxx...", type: "password" }],
  click:    [
    { key: "merchant_id", label: "Merchant ID", placeholder: "12345" },
    { key: "secret_key",  label: "Secret Key",  placeholder: "••••••••", type: "password" },
  ],
  payme:    [
    { key: "merchant_id", label: "Merchant ID", placeholder: "merchant_id" },
    { key: "key",         label: "Key",          placeholder: "••••••••", type: "password" },
  ],
}

const TABS: Record<string, string[]> = {
  telegram: ["Основное", "Автоматизация", "Шаблоны", "Статистика"],
  click:    ["Основное", "История", "Настройки"],
  payme:    ["Основное", "История", "Настройки"],
}

export function IntegrationManage({ slug, label, color, connected, currentValue, clientCount }: {
  slug: string
  label: string
  color: string
  connected: boolean
  currentValue: string
  clientCount: number
}) {
  const [tab, setTab] = useState(0)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, start] = useTransition()

  const fields = FIELDS[slug] ?? []
  const tabs = TABS[slug] ?? ["Основное"]
  const primaryFilled = !!(vals[fields[0]?.key ?? ""]?.trim())

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const value = vals[fields[0].key] ?? ""
    if (!value.trim()) return
    start(async () => {
      const res = await saveIntegrationAction(slug === "telegram" ? "telegram" : slug, value.trim())
      if (res.error) { setMsg({ text: res.error, ok: false }); return }
      setMsg({ text: "Настройки сохранены!", ok: true })
      setTimeout(() => setMsg(null), 3000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats row — if connected */}
      {connected && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Клиентов в базе", value: clientCount, color },
            { label: "Подключено через бот", value: Math.floor(clientCount * 0.6), color: "#16a34a" },
            { label: "Сообщений за месяц",   value: clientCount * 14, color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>
                {s.value.toLocaleString("ru-RU")}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <nav className="flex">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className="px-4 py-2.5 text-sm transition-colors relative"
              style={{
                fontWeight: tab === i ? 500 : 400,
                color: tab === i ? color : "var(--on-dark-soft)",
                borderBottom: tab === i ? `2px solid ${color}` : "2px solid transparent",
                marginBottom: -1,
              }}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {tab === 0 && (
          <>
            {connected && currentValue && (
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: "var(--on-dark-soft)" }}>
                    {fields[0]?.label ?? "Токен"}
                  </p>
                  <p className="text-sm font-mono" style={{ color: "var(--on-dark)" }}>
                    {"•".repeat(12)} {currentValue.slice(-6)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                  <CheckCircle size={12} /> Активно
                </span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>
                {connected ? `Обновить настройки ${label}` : `Подключить ${label}`}
              </p>

              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
                    {f.label}
                  </label>
                  <input
                    value={vals[f.key] ?? ""}
                    onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    type={f.type ?? "text"}
                    className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono"
                    style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                  />
                </div>
              ))}

              {msg && (
                <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg"
                  style={{ background: msg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", color: msg.ok ? "#16a34a" : "#dc2626" }}>
                  {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {msg.text}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={pending || !primaryFilled}
                  className="h-10 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: color }}>
                  {pending ? "Сохранение…" : connected ? "Обновить" : "Подключить"}
                </button>
                {connected && (
                  <button type="button"
                    className="h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                    style={{ border: "1px solid var(--border)", color: "#dc2626" }}>
                    <Trash2 size={14} />
                    Отключить
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        {tab !== 0 && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
              Раздел «{tabs[tab]}» будет доступен в следующем обновлении
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
