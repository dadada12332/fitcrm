"use client"

import Link from "next/link"
import { CheckCircle2, Circle, ArrowRight, Clock } from "lucide-react"

export type IntegrationStatus = {
  key: string
  connected: boolean
  handle?: string
  clientCount?: number
  lastSync?: string
}

const CATALOG = [
  {
    key: "telegram",
    label: "Telegram",
    description: "Личный кабинет клиентов",
    color: "#2AABEE",
    bg: "rgba(42,171,238,0.12)",
    features: ["QR-чекин", "Уведомления", "Продление", "Рассылка"],
    featureColor: "rgba(42,171,238,0.15)",
    featureText: "#0e7bb5",
    category: "Мессенджеры",
    available: true,
  },
  {
    key: "click",
    label: "Click",
    description: "Приём онлайн-платежей",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.12)",
    features: ["Онлайн-оплата", "Webhooks", "Автооплата", "История"],
    featureColor: "rgba(22,163,74,0.12)",
    featureText: "#166534",
    category: "Платежи",
    available: true,
  },
  {
    key: "payme",
    label: "Payme",
    description: "Приём онлайн-платежей",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.12)",
    features: ["Онлайн-оплата", "Webhooks", "Автооплата", "История"],
    featureColor: "rgba(124,58,237,0.12)",
    featureText: "#5b21b6",
    category: "Платежи",
    available: true,
  },
  {
    key: "instagram",
    label: "Instagram",
    description: "Заявки и лиды из Direct",
    color: "#E1306C",
    bg: "rgba(225,48,108,0.10)",
    features: ["Direct", "Лиды", "Автоответ", "CRM"],
    featureColor: "rgba(225,48,108,0.10)",
    featureText: "#9d174d",
    category: "Соцсети",
    available: false,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Уведомления и чат с клиентами",
    color: "#25D366",
    bg: "rgba(37,211,102,0.10)",
    features: ["Рассылка", "Чат", "Уведомления", "Боты"],
    featureColor: "rgba(37,211,102,0.10)",
    featureText: "#15803d",
    category: "Мессенджеры",
    available: false,
  },
  {
    key: "google-calendar",
    label: "Google Calendar",
    description: "Синхронизация расписания",
    color: "#4285F4",
    bg: "rgba(66,133,244,0.10)",
    features: ["Расписание", "События", "Тренеры", "Залы"],
    featureColor: "rgba(66,133,244,0.10)",
    featureText: "#1d4ed8",
    category: "Продуктивность",
    available: false,
  },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

function IntegrationCard({ integration, status }: {
  integration: typeof CATALOG[0]
  status: IntegrationStatus | undefined
}) {
  const connected = status?.connected ?? false

  return (
    <div
      className="rounded-2xl flex flex-col transition-shadow hover:shadow-md"
      style={{ background: "var(--card)", border: "1px solid var(--border)", overflow: "hidden" }}
    >
      {/* Top */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: integration.color }}>
            {integration.label[0]}
          </div>
          {integration.available ? (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={connected
                ? { background: "rgba(22,163,74,0.12)", color: "#16a34a" }
                : { background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
              {connected
                ? <><CheckCircle2 size={12} />Подключено</>
                : <><Circle size={12} />Не подключено</>}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "rgba(245,158,11,0.1)", color: "#b45309" }}>
              <Clock size={11} />Скоро
            </span>
          )}
        </div>

        <h3 className="font-semibold text-base mb-0.5" style={{ color: "var(--on-dark)" }}>
          {integration.label}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--on-dark-soft)" }}>
          {integration.description}
        </p>

        {/* Features */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {integration.features.map((f) => (
            <span key={f} className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: integration.featureColor, color: integration.featureText }}>
              {f}
            </span>
          ))}
        </div>

        {/* Connected stats */}
        {connected && status && (
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--card-2)" }}>
            {status.handle && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--on-dark-soft)" }}>Аккаунт</span>
                <span className="font-medium" style={{ color: "var(--on-dark)" }}>{status.handle}</span>
              </div>
            )}
            {status.clientCount !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--on-dark-soft)" }}>Клиентов</span>
                <span className="font-semibold" style={{ color: integration.color }}>{status.clientCount}</span>
              </div>
            )}
            {status.lastSync && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--on-dark-soft)" }}>Обновлено</span>
                <span style={{ color: "var(--on-dark-soft)" }}>{timeAgo(status.lastSync)}</span>
              </div>
            )}
          </div>
        )}

        {/* Not connected benefits */}
        {!connected && integration.available && (
          <div className="space-y-1">
            {getBenefits(integration.key).map((b) => (
              <div key={b} className="flex items-start gap-2 text-xs" style={{ color: "var(--on-dark-soft)" }}>
                <span className="mt-0.5 text-[10px]" style={{ color: integration.color }}>●</span>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer button */}
      <div className="px-5 pb-5">
        {integration.available ? (
          <Link href={`/integrations/${integration.key}`}
            className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all hover:opacity-90"
            style={connected
              ? { background: "var(--card-2)", color: "var(--on-dark)", border: "1px solid var(--border)" }
              : { background: integration.color, color: "white" }}>
            {connected ? "Управление" : "Подключить"}
            <ArrowRight size={14} />
          </Link>
        ) : (
          <div className="w-full h-10 rounded-xl flex items-center justify-center text-sm font-medium cursor-not-allowed"
            style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
            Скоро будет доступно
          </div>
        )}
      </div>
    </div>
  )
}

function getBenefits(key: string): string[] {
  const map: Record<string, string[]> = {
    telegram: ["Клиенты управляют абонементом через бот", "Автоматические напоминания об истечении", "QR-код для входа в зал"],
    click: ["Принимайте оплату онлайн через Click", "Автоматические webhooks о платежах", "История транзакций в CRM"],
    payme: ["Принимайте оплату онлайн через Payme", "Автоматические webhooks о платежах", "История транзакций в CRM"],
  }
  return map[key] ?? []
}

export function IntegrationsCatalog({ statuses }: { statuses: IntegrationStatus[] }) {
  const statusMap = new Map(statuses.map((s) => [s.key, s]))

  const available = CATALOG.filter((c) => c.available)
  const comingSoon = CATALOG.filter((c) => !c.available)

  return (
    <div className="space-y-8">
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {available.map((intg) => (
            <IntegrationCard key={intg.key} integration={intg} status={statusMap.get(intg.key)} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--on-dark-soft)" }}>
          СКОРО
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comingSoon.map((intg) => (
            <IntegrationCard key={intg.key} integration={intg} status={undefined} />
          ))}
        </div>
      </div>
    </div>
  )
}
