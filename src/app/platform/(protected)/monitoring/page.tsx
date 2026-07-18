import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Cloud,
  Clock,
  Database,
  HardDrive,
  MessageSquare,
  Send,
  Server,
  Sparkles,
} from "lucide-react"
import { createServiceClient } from "@/lib/supabase/service"
import { Panel, PageHeader } from "@/components/platform/parts"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type ServiceState = "verified" | "configured" | "not-configured" | "error"
type Service = {
  name: string
  icon: React.ReactNode
  state: ServiceState
  latency?: number
  note: string
}

const STATE_META: Record<ServiceState, { label: string; icon: typeof CheckCircle2; className: string; surface: string }> = {
  verified: { label: "Проверено", icon: CheckCircle2, className: "text-chart-2", surface: "bg-chart-2/10" },
  configured: { label: "Настроено", icon: CircleHelp, className: "text-chart-3", surface: "bg-chart-3/10" },
  "not-configured": { label: "Не подключено", icon: CircleHelp, className: "text-muted-foreground", surface: "bg-muted" },
  error: { label: "Ошибка", icon: AlertCircle, className: "text-destructive", surface: "bg-destructive/10" },
}

async function checkInfrastructure() {
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

export default async function MonitoringPage() {
  let checks: Awaited<ReturnType<typeof checkInfrastructure>> = {
    database: { ok: false, latency: 0 },
    storage: { ok: false, latency: 0 },
  }
  try {
    checks = await checkInfrastructure()
  } catch {
    // Missing credentials and transport failures are represented as explicit errors below.
  }

  const services: Service[] = [
    { name: "Supabase (DB)", icon: <Database />, state: checks.database.ok ? "verified" : "error", latency: checks.database.latency, note: "Живой запрос к PostgreSQL" },
    { name: "Storage", icon: <HardDrive />, state: checks.storage.ok ? "verified" : "error", latency: checks.storage.latency, note: "Живой запрос списка buckets" },
    { name: "Vercel", icon: <Cloud />, state: process.env.VERCEL ? "configured" : "not-configured", note: "Среда выполнения; отдельный uptime probe не подключён" },
    { name: "Telegram Bot", icon: <Send />, state: process.env.TELEGRAM_CRM_BOT_TOKEN ? "configured" : "not-configured", note: "Наличие server credentials; webhook не проверяется" },
    { name: "AI", icon: <Sparkles />, state: process.env.GEMINI_API_KEY ? "configured" : "not-configured", note: "Наличие Gemini credentials; quota не проверяется" },
    { name: "SMS", icon: <MessageSquare />, state: "not-configured", note: "SMS-провайдер ещё не подключён" },
    { name: "API", icon: <Server />, state: "configured", note: "Интерфейс открыт; внешняя телеметрия не подключена" },
    { name: "Cron", icon: <Clock />, state: process.env.CRON_SECRET ? "configured" : "not-configured", note: "Три расписания в vercel.json; история запусков не проверяется" },
  ]

  const verified = services.filter((service) => service.state === "verified").length
  const errors = services.filter((service) => service.state === "error").length

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Мониторинг" subtitle="Проверенные сигналы и состояние конфигурации инфраструктуры" />

      <Panel className={cn("mb-4 flex items-start gap-3 px-4 py-3.5", errors ? "border-destructive/30 bg-destructive/5" : "border-chart-2/30 bg-chart-2/5")}>
        {errors ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-chart-2" />}
        <div>
          <p className="text-sm font-semibold text-foreground">{errors ? `Ошибок живых проверок: ${errors}` : `Живые проверки пройдены: ${verified}`}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Жёлтый статус означает наличие конфигурации, а не подтверждённый аптайм сервиса.</p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {services.map((service) => {
          const meta = STATE_META[service.state]
          const StateIcon = meta.icon
          return (
            <Panel key={service.name} className="flex min-h-20 items-center gap-3 px-4 py-3.5">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&>svg]:size-5", meta.surface, meta.className)}>{service.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{service.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{service.note}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.className)}><StateIcon className="size-3.5" />{meta.label}</span>
                {service.latency !== undefined && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{service.latency} ms</p>}
              </div>
            </Panel>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">Для подтверждённого аптайма Vercel, Telegram, AI и Cron требуется внешняя телеметрия и история запусков.</p>
    </div>
  )
}
