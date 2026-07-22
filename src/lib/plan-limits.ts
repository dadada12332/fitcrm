export const LIMIT_KEYS = [
  "clients", "staff", "branches", "products", "roles", "integrations",
  "ai_requests", "telegram_messages", "imports", "exports",
] as const

export type LimitKey = typeof LIMIT_KEYS[number]

export const LIMIT_LABELS: Record<LimitKey, string> = {
  clients: "Клиенты",
  staff: "Сотрудники",
  branches: "Филиалы",
  products: "Товары",
  roles: "Пользовательские роли",
  integrations: "Интеграции",
  ai_requests: "AI-запросы",
  telegram_messages: "Telegram-сообщения",
  imports: "Импорты",
  exports: "Экспорты",
}

export type PlanLimitDetails = {
  key: LimitKey
  label: string
  limit: number
  planName: string
}

const LIMIT_ERROR = /^Достигнут лимит тарифа «(.+?)»: (.+?) — ([\d\s ]+)\./

export function isLimitKey(value: string): value is LimitKey {
  return (LIMIT_KEYS as readonly string[]).includes(value)
}

export function formatPlanLimitError(key: LimitKey, limit: number, planName: string): string {
  return `Достигнут лимит тарифа «${planName}»: ${LIMIT_LABELS[key]} — ${limit.toLocaleString("ru-RU")}. Перейдите на следующий тариф, чтобы продолжить работу.`
}

export function parsePlanLimitError(message: string): PlanLimitDetails | null {
  const match = message.match(LIMIT_ERROR)
  if (!match) return null
  const key = LIMIT_KEYS.find((item) => LIMIT_LABELS[item] === match[2])
  const limit = Number(match[3].replace(/[\s ]/g, ""))
  if (!key || !Number.isFinite(limit)) return null
  return { key, label: LIMIT_LABELS[key], limit, planName: match[1] }
}
