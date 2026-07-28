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
import { Panel, PageHeader } from "@/components/platform/parts"
import { cn } from "@/lib/utils"
import {
  getPlatformSystemStatus,
  type PlatformServiceState,
} from "@/lib/platform-monitoring"

export const dynamic = "force-dynamic"

const STATE_META: Record<PlatformServiceState, { label: string; icon: typeof CheckCircle2; className: string; surface: string }> = {
  verified: { label: "Проверено", icon: CheckCircle2, className: "text-chart-2", surface: "bg-chart-2/10" },
  configured: { label: "Настроено", icon: CircleHelp, className: "text-chart-3", surface: "bg-chart-3/10" },
  "not-configured": { label: "Не подключено", icon: CircleHelp, className: "text-muted-foreground", surface: "bg-muted" },
  error: { label: "Ошибка", icon: AlertCircle, className: "text-destructive", surface: "bg-destructive/10" },
}

const SERVICE_ICONS = {
  database: <Database />,
  storage: <HardDrive />,
  vercel: <Cloud />,
  telegram: <Send />,
  ai: <Sparkles />,
  sms: <MessageSquare />,
  api: <Server />,
  cron: <Clock />,
} satisfies Record<string, React.ReactNode>

export default async function MonitoringPage() {
  const status = await getPlatformSystemStatus()

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Мониторинг" subtitle="Проверенные сигналы и состояние конфигурации инфраструктуры" />

      <Panel className={cn("mb-4 flex items-start gap-3 px-4 py-3.5", status.errors ? "border-destructive/30 bg-destructive/5" : "border-chart-2/30 bg-chart-2/5")}>
        {status.errors ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-chart-2" />}
        <div>
          <p className="text-sm font-semibold text-foreground">{status.errors ? `Ошибок живых проверок: ${status.errors}` : `Живые проверки пройдены: ${status.verified}`}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Жёлтый статус означает наличие конфигурации, а не подтверждённый аптайм сервиса.</p>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {status.services.map((service) => {
          const meta = STATE_META[service.state]
          const StateIcon = meta.icon
          return (
            <Panel key={service.name} className="flex min-h-20 items-center gap-3 px-4 py-3.5">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&>svg]:size-5", meta.surface, meta.className)}>{SERVICE_ICONS[service.key]}</div>
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
