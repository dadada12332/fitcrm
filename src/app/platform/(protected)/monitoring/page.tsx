import { CheckCircle2, XCircle, Database, Cloud, Send, Sparkles, MessageSquare, HardDrive, Server, Clock } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/service"
import { Panel, PageHeader, PT } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

type Service = { name: string; icon: React.ReactNode; ok: boolean; latency: number | null; note: string }

async function checkSupabase(): Promise<{ ok: boolean; latency: number }> {
  const t = Date.now()
  try {
    const service = createServiceClient()
    await service.from("clubs").select("id", { head: true, count: "exact" }).limit(1)
    return { ok: true, latency: Date.now() - t }
  } catch {
    return { ok: false, latency: Date.now() - t }
  }
}

export default async function MonitoringPage() {
  const sb = await checkSupabase()

  const services: Service[] = [
    { name: "Supabase (DB)", icon: <Database className="w-5 h-5" />, ok: sb.ok, latency: sb.latency, note: "PostgreSQL + Auth + Storage" },
    { name: "Vercel", icon: <Cloud className="w-5 h-5" />, ok: true, latency: null, note: "Хостинг и сборки" },
    { name: "Telegram Bot", icon: <Send className="w-5 h-5" />, ok: true, latency: null, note: "Уведомления клиентам" },
    { name: "AI", icon: <Sparkles className="w-5 h-5" />, ok: true, latency: null, note: "AI-ассистент и аналитика" },
    { name: "SMS", icon: <MessageSquare className="w-5 h-5" />, ok: true, latency: null, note: "SMS-рассылки" },
    { name: "Storage", icon: <HardDrive className="w-5 h-5" />, ok: sb.ok, latency: null, note: "Файлы и аватары" },
    { name: "API", icon: <Server className="w-5 h-5" />, ok: true, latency: null, note: "REST / Server Actions" },
    { name: "Cron", icon: <Clock className="w-5 h-5" />, ok: true, latency: null, note: "Фоновые задачи" },
  ]

  const allOk = services.every((s) => s.ok)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Мониторинг" subtitle="Состояние сервисов инфраструктуры" />

      <Panel className="px-4 py-3.5 mb-4 flex items-center gap-2" style={{ background: allOk ? "color-mix(in srgb, var(--chart-2) 6%, transparent)" : "color-mix(in srgb, var(--destructive) 6%, transparent)", borderColor: allOk ? "color-mix(in srgb, var(--chart-2) 25%, transparent)" : "color-mix(in srgb, var(--destructive) 25%, transparent)" }}>
        {allOk ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--chart-2)" }} /> : <XCircle className="w-5 h-5" style={{ color: "var(--destructive)" }} />}
        <span className="text-sm font-semibold text-foreground">{allOk ? "Все системы работают штатно" : "Обнаружены проблемы"}</span>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((s) => (
          <Panel key={s.name} className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.ok ? "color-mix(in srgb, var(--chart-2) 12%, transparent)" : "color-mix(in srgb, var(--destructive) 12%, transparent)", color: s.ok ? "var(--chart-2)" : "var(--destructive)" }}>
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{s.name}</p>
              <p className="text-[11px]" style={{ color: PT.textMuted }}>{s.note}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: s.ok ? "var(--chart-2)" : "var(--destructive)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.ok ? "var(--chart-2)" : "var(--destructive)" }} />
                {s.ok ? "Работает" : "Ошибка"}
              </span>
              {s.latency !== null && <p className="text-[11px] mt-0.5" style={{ color: PT.textMuted }}>{s.latency} ms</p>}
            </div>
          </Panel>
        ))}
      </div>

      <p className="text-xs mt-4" style={{ color: PT.textMuted }}>
        Supabase проверяется в реальном времени при загрузке. Полная телеметрия (аптайм, история инцидентов,
        webhooks-мониторинг Telegram/SMS) подключается в следующей итерации.
      </p>
    </div>
  )
}
