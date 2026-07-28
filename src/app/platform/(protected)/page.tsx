import Link from "next/link"
import {
  CheckCircle2, CircleHelp, TrendingUp, Building2, AlertTriangle,
  Flame, CreditCard, UserPlus, Clock, ArrowRight,
} from "lucide-react"
import { getPlatformOverview, getLiveEvents, getAttentionClubs, platformBase } from "@/lib/platform"
import { getPlatformSystemStatus, type PlatformServiceState } from "@/lib/platform-monitoring"
import { Panel, StatTile, fmtNum, fmtSum, timeAgo, PT } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

const SERVICE_DOT: Record<PlatformServiceState, string> = {
  verified: "var(--chart-2)",
  configured: "var(--chart-3)",
  "not-configured": "var(--muted-foreground)",
  error: "var(--destructive)",
}

export default async function CommandCenterPage() {
  const [o, events, attention, base, system] = await Promise.all([
    getPlatformOverview(),
    getLiveEvents(18),
    getAttentionClubs(8),
    platformBase(),
    getPlatformSystemStatus(),
  ])

  const hasErrors = system.errors > 0
  const now = new Date()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Командный центр</h1>
          <p className="text-sm mt-1" style={{ color: PT.textMuted }}>
            {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* System status bar */}
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-4 py-3" style={{ background: hasErrors ? "color-mix(in srgb, var(--destructive) 6%, transparent)" : "color-mix(in srgb, var(--chart-3) 6%, transparent)", borderColor: hasErrors ? "color-mix(in srgb, var(--destructive) 25%, transparent)" : "color-mix(in srgb, var(--chart-3) 25%, transparent)" }}>
        <div className="flex items-center gap-2">
          {hasErrors
            ? <AlertTriangle className="size-5 text-destructive" />
            : <CircleHelp className="size-5 text-chart-3" />}
          <span className="text-sm font-semibold text-foreground">
            {hasErrors
              ? `Ошибок живых проверок: ${system.errors}`
              : `${system.verified} проверено · ${system.configured} настроено · ${system.notConfigured} не подключено`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {system.services.map((service) => (
            <span key={service.key} title={service.note} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: SERVICE_DOT[service.state] }} />
              {service.name}
            </span>
          ))}
        </div>
      </Panel>

      {/* Hero metrics */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <HeroCard
          icon={<TrendingUp className="w-5 h-5" style={{ color: "var(--chart-2)" }} />}
          label="MRR" value={fmtSum(o.mrr)} sub={`ARR ${fmtSum(o.arr)}`} tint="color-mix(in srgb, var(--chart-2) 8%, transparent)" border="color-mix(in srgb, var(--chart-2) 20%, transparent)"
        />
        <HeroCard
          icon={<Building2 className="w-5 h-5" style={{ color: "var(--brand)" }} />}
          label="Активных клубов" value={fmtNum(o.activeClubs)} sub={`из ${fmtNum(o.totalClubs)} всего`} tint="color-mix(in srgb, var(--brand) 8%, transparent)" border="color-mix(in srgb, var(--brand) 20%, transparent)"
        />
        <HeroCard
          icon={<AlertTriangle className="w-5 h-5" style={{ color: "var(--chart-3)" }} />}
          label="Требуют внимания" value={fmtNum(o.attentionClubs)} sub="просрочки и блокировки" tint="color-mix(in srgb, var(--chart-3) 8%, transparent)" border="color-mix(in srgb, var(--chart-3) 20%, transparent)"
        />
        <HeroCard
          icon={<UserPlus className="w-5 h-5" style={{ color: "var(--chart-4)" }} />}
          label="Новых клубов" value={fmtNum(o.newClubs30)} sub="за 30 дней" tint="color-mix(in srgb, var(--chart-4) 8%, transparent)" border="color-mix(in srgb, var(--chart-4) 20%, transparent)"
        />
      </div>

      {/* KPI grid */}
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-4">
        <StatTile label="Trial-клубов" value={fmtNum(o.trialClubs)} />
        <StatTile label="Просрочено" value={fmtNum(o.expiredClubs)} accent={o.expiredClubs > 0 ? "var(--destructive)" : undefined} />
        <StatTile label="Пользователей" value={fmtNum(o.totalUsers)} />
        <StatTile label="Клиентов всего" value={fmtNum(o.totalClients)} />
        <StatTile label="Визитов сегодня" value={fmtNum(o.visitsToday)} />
        <StatTile label="Визитов за 30д" value={fmtNum(o.visits30)} />
        <StatTile label="Оплат сегодня" value={fmtNum(o.paymentsToday)} />
        <StatTile label="Выручка клубов 30д" value={fmtSum(o.revenue30)} />
      </div>

      {/* Two columns: attention + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attention */}
        <Panel>
          <div className="flex items-center justify-between px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: "var(--chart-3)" }} />
              <span className="text-sm font-semibold text-foreground">Требует внимания</span>
            </div>
            <Link href={`${base}/clubs`} className="text-xs flex items-center gap-1 hover:text-foreground transition-colors" style={{ color: PT.textMuted }}>
              Все клубы <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2">
            {attention.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2 className="w-8 h-8" style={{ color: "var(--chart-2)" }} />
                <p className="text-sm" style={{ color: PT.textMuted }}>Всё под контролем</p>
              </div>
            ) : attention.map((a) => (
              <Link key={a.id} href={`${base}/clubs/${a.id}`} className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-colors hover:bg-muted/60">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.severity === "alert" ? "var(--destructive)" : "var(--chart-3)" }} />
                <span className="text-sm text-foreground flex-1 truncate">{a.name}</span>
                <span className="max-w-[45%] truncate text-xs" style={{ color: a.severity === "alert" ? "var(--destructive)" : "var(--chart-3)" }}>{a.reason}</span>
              </Link>
            ))}
          </div>
        </Panel>

        {/* Live feed */}
        <Panel>
          <div className="flex items-center gap-2 px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <Flame className="w-4 h-4" style={{ color: "var(--chart-3)" }} />
            <span className="text-sm font-semibold text-foreground">Последние события</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: PT.textMuted }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--chart-2)" }} /> в реальном времени
            </span>
          </div>
          <div className="p-2 max-h-[420px] overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: PT.textMuted }}>Событий пока нет</p>
            ) : events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: EVENT_STYLE[e.type].bg }}>
                  {EVENT_STYLE[e.type].icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{e.title}</p>
                  <p className="text-xs truncate" style={{ color: PT.textMuted }}>{e.subtitle}</p>
                </div>
                <span className="text-[11px] shrink-0 flex items-center gap-1" style={{ color: PT.textMuted }}>
                  <Clock className="w-3 h-3" />{timeAgo(e.at)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

const EVENT_STYLE: Record<string, { bg: string; icon: React.ReactNode }> = {
  new_club:      { bg: "color-mix(in srgb, var(--brand) 15%, transparent)",  icon: <Building2 className="w-4 h-4" style={{ color: "var(--brand)" }} /> },
  payment:       { bg: "color-mix(in srgb, var(--chart-2) 15%, transparent)",   icon: <CreditCard className="w-4 h-4" style={{ color: "var(--chart-2)" }} /> },
  new_client:    { bg: "color-mix(in srgb, var(--chart-4) 15%, transparent)",  icon: <UserPlus className="w-4 h-4" style={{ color: "var(--chart-4)" }} /> },
  trial_expiring:{ bg: "color-mix(in srgb, var(--chart-3) 15%, transparent)",  icon: <AlertTriangle className="w-4 h-4" style={{ color: "var(--chart-3)" }} /> },
}

function HeroCard({ icon, label, value, sub, tint, border }: { icon: React.ReactNode; label: string; value: string; sub: string; tint: string; border: string }) {
  return (
    <div className="rounded-lg px-4 py-4" style={{ background: tint, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: PT.textSoft }}>{label}</span>
        {icon}
      </div>
      <p className="break-words text-[28px] font-semibold leading-none text-foreground">{value}</p>
      <p className="text-[11px] mt-1.5" style={{ color: PT.textMuted }}>{sub}</p>
    </div>
  )
}
