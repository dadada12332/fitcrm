// Локальные метки тарифов (client-safe — без импортов из server-модулей).
const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  standard: "Standard",
  business: "Business",
}

// ── Форматирование ────────────────────────────────────────────
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

// ── Токены платформенной темы ─────────────────────────────────
export const PT = {
  bg: "#0a0f1c",
  panel: "#0f172a",
  panelBorder: "#1e293b",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textSoft: "#94a3b8",
  accent: "#6366f1",
}

// ── Карточка-панель ───────────────────────────────────────────
export function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, ...style }}
    >
      {children}
    </div>
  )
}

// ── Компактная метрика ────────────────────────────────────────
export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Panel className="px-4 py-3.5">
      <p className="text-xs" style={{ color: PT.textMuted }}>{label}</p>
      <p className="text-[22px] font-semibold mt-1 tracking-[-0.3px]" style={{ color: accent ?? "#fff" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: PT.textSoft }}>{sub}</p>}
    </Panel>
  )
}

// ── Бейджи ────────────────────────────────────────────────────
export function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    trial:    { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" },
    starter:  { bg: "rgba(59,130,246,0.15)",  fg: "#60a5fa" },
    standard: { bg: "rgba(139,92,246,0.15)",  fg: "#a78bfa" },
    business: { bg: "rgba(34,197,94,0.15)",   fg: "#4ade80" },
  }
  const s = map[plan] ?? map.trial
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-md text-[11px] font-medium" style={{ background: s.bg, color: s.fg }}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active:    { bg: "rgba(34,197,94,0.15)",  fg: "#4ade80", label: "Активен" },
    suspended: { bg: "rgba(239,68,68,0.15)",  fg: "#f87171", label: "Заблокирован" },
    deleted:   { bg: "rgba(100,116,139,0.15)", fg: "#94a3b8", label: "Удалён" },
  }
  const s = map[status] ?? map.active
  return (
    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-md text-[11px] font-medium" style={{ background: s.bg, color: s.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {s.label}
    </span>
  )
}

export function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#84cc16" : score >= 40 ? "#f59e0b" : score >= 20 ? "#f97316" : "#ef4444"
  const label = score >= 80 ? "Отлично" : score >= 60 ? "Хорошо" : score >= 40 ? "Средне" : score >= 20 ? "Риск" : "Критично"
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{score}</span>
      <span className="text-[11px] hidden xl:inline" style={{ color: PT.textMuted }}>{label}</span>
    </div>
  )
}

// ── Заголовок страницы ────────────────────────────────────────
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-[-0.3px]">{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: PT.textMuted }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

// ── Заглушка «в разработке» ───────────────────────────────────
export function ComingSoon({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="p-6 lg:p-8">
      <PageHeader title={title} />
      <Panel className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
          {icon}
        </div>
        <p className="text-lg font-semibold text-white mb-1.5">Раздел в разработке</p>
        <p className="text-sm max-w-md" style={{ color: PT.textMuted }}>{description}</p>
      </Panel>
    </div>
  )
}
