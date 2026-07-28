import { createServiceClient } from "@/lib/supabase/service"

export type PlatformServiceState = "verified" | "configured" | "not-configured" | "error"

export type PlatformServiceStatus = {
  key: "database" | "storage" | "vercel" | "telegram" | "ai" | "sms" | "api" | "cron"
  name: string
  state: PlatformServiceState
  latency?: number
  note: string
}

export type PlatformSystemStatus = {
  services: PlatformServiceStatus[]
  verified: number
  configured: number
  notConfigured: number
  errors: number
}

async function liveInfrastructureChecks() {
  const service = createServiceClient()

  const dbStartedAt = Date.now()
  const database = await service.from("clubs").select("id", { head: true, count: "exact" }).limit(1)
  const dbLatency = Date.now() - dbStartedAt

  const storageStartedAt = Date.now()
  const storage = await service.storage.listBuckets()
  const storageLatency = Date.now() - storageStartedAt

  return {
    database: { ok: !database.error, latency: dbLatency },
    storage: { ok: !storage.error, latency: storageLatency },
  }
}

export async function getPlatformSystemStatus(): Promise<PlatformSystemStatus> {
  let checks: Awaited<ReturnType<typeof liveInfrastructureChecks>> = {
    database: { ok: false, latency: 0 },
    storage: { ok: false, latency: 0 },
  }

  try {
    checks = await liveInfrastructureChecks()
  } catch {
    // Transport and missing-credential failures are represented as errors below.
  }

  const services: PlatformServiceStatus[] = [
    {
      key: "database",
      name: "Supabase (DB)",
      state: checks.database.ok ? "verified" : "error",
      latency: checks.database.latency,
      note: "Живой запрос к PostgreSQL",
    },
    {
      key: "storage",
      name: "Storage",
      state: checks.storage.ok ? "verified" : "error",
      latency: checks.storage.latency,
      note: "Живой запрос списка buckets",
    },
    {
      key: "vercel",
      name: "Vercel",
      state: process.env.VERCEL ? "configured" : "not-configured",
      note: "Среда выполнения; отдельный uptime probe не подключён",
    },
    {
      key: "telegram",
      name: "Telegram Bot",
      state: process.env.TELEGRAM_CRM_BOT_TOKEN ? "configured" : "not-configured",
      note: "Наличие server credentials; webhook не проверяется",
    },
    {
      key: "ai",
      name: "AI",
      state: process.env.GEMINI_API_KEY ? "configured" : "not-configured",
      note: "Наличие Gemini credentials; quota не проверяется",
    },
    {
      key: "sms",
      name: "SMS",
      state: "not-configured",
      note: "SMS-провайдер ещё не подключён",
    },
    {
      key: "api",
      name: "API",
      state: "configured",
      note: "Интерфейс открыт; внешняя телеметрия не подключена",
    },
    {
      key: "cron",
      name: "Cron",
      state: process.env.CRON_SECRET ? "configured" : "not-configured",
      note: "Расписания настроены; история запусков не проверяется",
    },
  ]

  return {
    services,
    verified: services.filter((service) => service.state === "verified").length,
    configured: services.filter((service) => service.state === "configured").length,
    notConfigured: services.filter((service) => service.state === "not-configured").length,
    errors: services.filter((service) => service.state === "error").length,
  }
}
