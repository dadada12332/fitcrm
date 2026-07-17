import { Badge } from "@/components/ui/badge"

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  standard: "Standard",
  business: "Business",
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU")
}

export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US")
}

export function fmtSum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " сум"
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "только что"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} дн назад`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} мес назад`
  return `${Math.floor(mo / 12)} г назад`
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Compatibility map for existing platform screens. Values point to the shared design tokens.
export const PT = {
  bg: "var(--background)",
  panel: "var(--card)",
  panelBorder: "var(--border)",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  textSoft: "var(--muted-foreground)",
  accent: "var(--primary)",
}

export function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`rounded-lg border border-border bg-card ${className}`} style={style}>
      {children}
    </section>
  )
}

export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Panel className="px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold text-foreground" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Panel>
  )
}

export function PlanBadge({ plan }: { plan: string }) {
  const className = plan === "business"
    ? "bg-brand/10 text-brand"
    : plan === "standard"
      ? "bg-primary/10 text-foreground"
      : "bg-secondary text-muted-foreground"
  return <Badge variant="secondary" className={className}>{PLAN_LABELS[plan] ?? plan}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const label = status === "suspended" ? "Заблокирован" : status === "deleted" ? "Удалён" : "Активен"
  const className = status === "suspended"
    ? "bg-destructive/10 text-destructive"
    : status === "deleted"
      ? "bg-secondary text-muted-foreground"
      : "bg-brand/10 text-brand"
  return (
    <Badge variant="secondary" className={className}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}

export function HealthBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-brand text-brand" : score >= 60 ? "bg-primary text-foreground" : score >= 40 ? "bg-muted-foreground text-muted-foreground" : "bg-destructive text-destructive"
  const label = score >= 80 ? "Отлично" : score >= 60 ? "Хорошо" : score >= 40 ? "Средне" : score >= 20 ? "Риск" : "Критично"
  const [barClass, textClass] = tone.split(" ")
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textClass}`}>{score}</span>
      <span className="hidden text-[11px] text-muted-foreground xl:inline">{label}</span>
    </div>
  )
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function ComingSoon({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-4 sm:p-6 lg:p-8">
      <PageHeader title={title} />
      <div className="flex min-h-80 flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</div>
        <p className="mb-1.5 text-lg font-semibold text-foreground">Раздел в разработке</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
