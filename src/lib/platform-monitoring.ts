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
  cronRuns: {
    jobKey: string
    status: string
    startedAt: string
    durationMs: number | null
    errorMessage: string | null
  }[]
  verified: number
  configured: number
  notConfigured: number
  errors: number
}

async function liveInfrastructureChecks() {
  const service = createServiceClient()
  const timed = async (check: () => Promise<boolean>) => {
    const startedAt = Date.now()
    try {
      return { ok: await check(), latency: Date.now() - startedAt }
    } catch {
      return { ok: false, latency: Date.now() - startedAt }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
  const [database, storage, api, telegram] = await Promise.all([
    timed(async () => !(await service.from("clubs").select("id", { head: true, count: "exact" }).limit(1)).error),
    timed(async () => !(await service.storage.listBuckets()).error),
    timed(async () => {
      if (!appUrl) return false
      const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      return response.ok
    }),
    timed(async () => {
      if (!process.env.TELEGRAM_CRM_BOT_TOKEN) return false
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_CRM_BOT_TOKEN}/getMe`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      return response.ok
    }),
  ])

  return { database, storage, api, telegram }
}

export async function getPlatformSystemStatus(): Promise<PlatformSystemStatus> {
  let checks: Awaited<ReturnType<typeof liveInfrastructureChecks>> = {
    database: { ok: false, latency: 0 },
    storage: { ok: false, latency: 0 },
    api: { ok: false, latency: 0 },
    telegram: { ok: false, latency: 0 },
  }

  try {
    checks = await liveInfrastructureChecks()
  } catch {
    // Transport and missing-credential failures are represented as errors below.
  }

  const db = createServiceClient()
  await db.from("platform_service_checks").insert([
    { service_key: "database", status: checks.database.ok ? "ok" : "down", latency_ms: checks.database.latency },
    { service_key: "storage", status: checks.storage.ok ? "ok" : "down", latency_ms: checks.storage.latency },
    { service_key: "api", status: checks.api.ok ? "ok" : "down", latency_ms: checks.api.latency },
    { service_key: "telegram", status: checks.telegram.ok ? "ok" : process.env.TELEGRAM_CRM_BOT_TOKEN ? "down" : "degraded", latency_ms: checks.telegram.latency },
  ]).then(() => undefined, () => undefined)

  const { data: cronRows } = await db.from("platform_cron_runs")
    .select("job_key, status, started_at, duration_ms, error_message")
    .order("started_at", { ascending: false })
    .limit(100)
  const cronRuns = Array.from(new Map((cronRows ?? []).map((run) => [run.job_key, run])).values())
  const latestCron = cronRuns[0]
  const cronHealthy = latestCron?.status === "success"

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
      state: !process.env.TELEGRAM_CRM_BOT_TOKEN ? "not-configured" : checks.telegram.ok ? "verified" : "error",
      latency: checks.telegram.latency,
      note: checks.telegram.ok ? "Telegram getMe ответил" : "Проверка Telegram API не пройдена",
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
      state: checks.api.ok ? "verified" : "error",
      latency: checks.api.latency,
      note: checks.api.ok ? "Публичный /api/health ответил" : "Публичный health endpoint недоступен",
    },
    {
      key: "cron",
      name: "Cron",
      state: !process.env.CRON_SECRET ? "not-configured" : !latestCron ? "configured" : cronHealthy ? "verified" : "error",
      note: !latestCron ? "Расписания настроены; запусков в истории пока нет" : `Последний запуск: ${latestCron.job_key}`,
    },
  ]

  return {
    services,
    cronRuns: cronRuns.map((run) => ({
      jobKey: run.job_key,
      status: run.status,
      startedAt: run.started_at,
      durationMs: run.duration_ms,
      errorMessage: run.error_message,
    })),
    verified: services.filter((service) => service.state === "verified").length,
    configured: services.filter((service) => service.state === "configured").length,
    notConfigured: services.filter((service) => service.state === "not-configured").length,
    errors: services.filter((service) => service.state === "error").length,
  }
}
