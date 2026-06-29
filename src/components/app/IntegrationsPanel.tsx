"use client"

import { useState, useTransition } from "react"
import { saveIntegrationAction } from "@/app/(app)/settings/club/actions"

const INTEGRATIONS = [
  {
    key: "telegram", label: "Telegram Bot", desc: "OTP-коды и уведомления клиентам", color: "#2563eb",
    fields: [{ key: "token", label: "Bot Token", placeholder: "1234567890:AAF..." }],
  },
  {
    key: "click", label: "Click", desc: "Приём онлайн-платежей через Click", color: "#16a34a",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "12345" },
      { key: "secret_key",  label: "Secret Key",  placeholder: "••••••••" },
    ],
  },
  {
    key: "payme", label: "Payme", desc: "Приём онлайн-платежей через Payme", color: "#7c3aed",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "merchant_id" },
      { key: "key",         label: "Key",          placeholder: "••••••••" },
    ],
  },
] as const

type Integration = typeof INTEGRATIONS[number]

function IntegrationCard({ integration }: { integration: Integration }) {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, start] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const primaryKey = integration.fields[0].key
    const value = vals[primaryKey] ?? ""
    if (!value.trim()) return
    start(async () => {
      const res = await saveIntegrationAction(integration.key, value.trim())
      if (res.error) { setMsg({ text: res.error, ok: false }); return }
      setMsg({ text: "Сохранено!", ok: true })
      setOpen(false)
      setTimeout(() => setMsg(null), 2500)
    })
  }

  const primaryFilled = !!(vals[integration.fields[0].key]?.trim())

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-4 p-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: integration.color }}>
          {integration.label[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{integration.label}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{integration.desc}</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-9 px-4 rounded-lg text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}
        >
          {open ? "Отмена" : "Подключить"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-4 space-y-3">
            {integration.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>
                  {f.label}
                </label>
                <input
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  type={f.key.includes("key") || f.key === "token" ? "password" : "text"}
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                  style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                />
              </div>
            ))}
          </div>

          {msg && (
            <div className="text-sm px-4 py-2 rounded-lg"
              style={{ background: msg.ok ? "#f0fdf4" : "#fef2f2", color: msg.ok ? "#16a34a" : "#dc2626" }}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !primaryFilled}
            className="h-10 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#2563eb" }}
          >
            {pending ? "Сохранение..." : "Сохранить"}
          </button>
        </form>
      )}

      {msg && !open && (
        <div className="px-5 pb-4">
          <div className="text-sm px-4 py-2 rounded-lg"
            style={{ background: "#f0fdf4", color: "#16a34a" }}>
            {msg.text}
          </div>
        </div>
      )}
    </div>
  )
}

export function IntegrationsPanel() {
  return (
    <div className="space-y-3">
      {INTEGRATIONS.map((intg) => (
        <IntegrationCard key={intg.key} integration={intg} />
      ))}
    </div>
  )
}
