"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AlertTriangle, TrendingUp, TrendingDown, CreditCard,
  Activity, Users, UserCog, Wallet, Sparkles, RefreshCw,
  ArrowRight, Download, CheckCircle2, BarChart2,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts"
import type { ReportsData, ReportPayment, ReportClient, ReportStaffRow, FinanceAgg, SalesAgg, VisitsAgg, ClientsAgg, RenewalsAgg, DebtsAgg, AlertsAgg } from "@/lib/reports"
import { loadReportsDataAction, loadFinanceAction, loadSalesAction, loadVisitsAction, loadClientsAction, loadRenewalsAction, loadDebtsAction, loadStaffAction, loadAlertsAction, getReportsForecastAction, type ForecastInput } from "@/app/(app)/reports/actions"
import { downloadCSV } from "@/lib/csv"

// ── Types ────────────────────────────────────────────────────────────

type Period = "today" | "7d" | "30d" | "90d" | "year"
type Section = "alerts" | "finance" | "sales" | "visits" | "renewals" | "clients" | "staff" | "debts" | "ai"

// ── Helpers ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", manager: "Менеджер", admin: "Администратор",
  trainer: "Тренер", accountant: "Бухгалтер",
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: "Активен",  bg: "rgba(22,163,74,0.12)",  color: "#16a34a" },
  vacation: { label: "Отпуск",   bg: "rgba(217,119,6,0.12)",  color: "#d97706" },
  fired:    { label: "Уволен",   bg: "rgba(220,38,38,0.12)",  color: "#dc2626" },
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: "#e1306c", telegram: "#2ca5e0", recommendation: "#7c3aed",
  passerby: "#059669", google: "#ea4335", other: "#6b7280",
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram", telegram: "Telegram", recommendation: "Рекомендации",
  passerby: "Проходящие", google: "Google", other: "Другое",
}

function fmt(n: number) { return n.toLocaleString("ru-RU") }

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function periodBounds(period: Period) {
  const now = new Date()
  const durationMs = {
    today: now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    "7d":  7  * 86_400_000,
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
    year:  365 * 86_400_000,
  }[period]

  const fromTs = period === "today"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    : now.getTime() - durationMs

  const from    = new Date(fromTs).toISOString()
  const to      = now.toISOString()
  const prevFrom = new Date(fromTs - durationMs).toISOString()
  const prevTo  = from

  return { from, to, prevFrom, prevTo }
}

function pct(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

// Сэмплирование готового daily-ряда (из RPC) в точки графика — та же логика,
// что и в aggregateByDay (шаг 1/2/7 по числу дней, метка MM.DD).
function chartFromByDay(byDay: Array<{ day: string; amount: number }>): Array<{ label: string; value: number }> {
  const total = byDay.length
  const step = total <= 14 ? 1 : total <= 60 ? 2 : 7
  return byDay
    .filter((_, i) => i % step === 0 || i === total - 1)
    .map(({ day, amount }) => ({ label: day.slice(5).replace("-", "."), value: amount }))
}

// ── Shared sub-components ─────────────────────────────────────────────

const chartTooltipStyle = {
  contentStyle: {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 8, fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  },
  labelStyle:   { color: "var(--on-dark-soft)", fontWeight: 500 },
  itemStyle:    { color: "var(--on-dark)", fontWeight: 600 },
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── 1. Alerts Section ────────────────────────────────────────────────

function AlertsSection({ agg, visitsDelta, onNavigate }: {
  agg: AlertsAgg
  visitsDelta: number
  onNavigate: (s: Section) => void
}) {
  const expiringSoonCount = agg.expiringSoonCount
  const atRiskCount       = agg.atRiskCount
  const debtsCount        = agg.debtsCount
  const debtTotal         = agg.debtTotal

  // Единые карточки: метрика + смысл + действие в одной плашке (без дублирования).
  const LVL = {
    high:   { color: "#dc2626", label: "Срочно" },
    medium: { color: "#d97706", label: "Внимание" },
    low:    { color: "#16a34a", label: "В норме" },
  } as const
  type Card = { label: string; value: string; sub?: string; icon: typeof AlertTriangle; level: keyof typeof LVL; section?: Section }
  const cards: Card[] = [
    {
      label: "Истекает в 3 дня", value: String(expiringSoonCount), icon: AlertTriangle,
      level: expiringSoonCount > 0 ? "high" : "low",
      sub: expiringSoonCount > 0 ? (agg.expiringSoonNames.slice(0, 2).join(", ") + (expiringSoonCount > 2 ? ` и ещё ${expiringSoonCount - 2}` : "")) : "Нет истекающих",
      section: expiringSoonCount > 0 ? "renewals" : undefined,
    },
    {
      label: "Не приходили 14+ дн", value: String(atRiskCount), icon: Users,
      level: atRiskCount > 0 ? "medium" : "low",
      sub: atRiskCount > 0 ? "Риск оттока — стоит связаться" : "Все активны",
      section: atRiskCount > 0 ? "clients" : undefined,
    },
    {
      label: "Долги", value: String(debtsCount), icon: Wallet,
      level: debtsCount > 0 ? "high" : "low",
      sub: debtsCount > 0 ? `${fmt(debtTotal)} сум · требуют напоминания` : "Нет задолженностей",
      section: debtsCount > 0 ? "debts" : undefined,
    },
    {
      label: "Посещаемость", value: `${visitsDelta > 0 ? "+" : ""}${visitsDelta}%`, icon: Activity,
      level: visitsDelta < -10 ? "medium" : "low",
      sub: visitsDelta < -10 ? "Снижение к прошлому периоду" : visitsDelta > 15 ? "Отличная динамика!" : "Стабильно",
      section: "visits",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const lvl = LVL[c.level]
        const Icon = c.icon
        const interactive = !!c.section
        return (
          <button key={c.label} onClick={interactive ? () => onNavigate(c.section!) : undefined} disabled={!interactive}
            className="group flex h-full flex-col gap-3 rounded-lg p-5 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0" style={{ background: `color-mix(in srgb, ${lvl.color} 12%, transparent)` }}>
                <Icon className="h-[18px] w-[18px]" style={{ color: lvl.color }} />
              </div>
              {c.level !== "low" && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${lvl.color} 12%, transparent)`, color: lvl.color }}>{lvl.label}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{c.label}</p>
              <p className="text-3xl font-semibold tracking-[-0.27px] mt-0.5" style={{ color: "var(--on-dark)" }}>{c.value}</p>
              {c.sub && <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{c.sub}</p>}
            </div>
            {interactive && (
              <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: lvl.color }}>
                Открыть <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Скелетон вкладки на время загрузки серверной агрегации.
function SectionLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 flex flex-col gap-3" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="h-4 w-24 rounded" style={{ background: "var(--card-2)" }} />
            <div className="h-8 w-28 rounded" style={{ background: "var(--card-2)" }} />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
    </div>
  )
}

// ── 2. Finance Section ────────────────────────────────────────────────

function FinanceSection({ agg, bounds }: {
  agg: FinanceAgg
  bounds: ReturnType<typeof periodBounds>
}) {
  const revenue     = agg.revenue
  const count       = agg.count
  const prevRevenue = agg.prevRevenue
  const revDelta    = pct(revenue, prevRevenue)
  const avgCheck    = count ? Math.round(revenue / count) : 0
  const days        = daysBetween(bounds.from, bounds.to)
  const revenuePerDay = days > 0 ? Math.round(revenue / days) : 0

  const chartData = chartFromByDay(agg.byDay)

  const PROVIDER_LABELS: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
  const PROVIDER_COLORS: Record<string, string> = { cash: "#059669", click: "#2563eb", payme: "#7c3aed", uzum: "#d97706" }
  const providerData = agg.byProvider.map(({ provider, amount }) => ({
    name: PROVIDER_LABELS[provider] ?? provider, value: amount, color: PROVIDER_COLORS[provider] ?? "#6b7280",
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Выручка",     value: `${fmt(revenue)} сум`,       icon: TrendingUp, delta: revDelta,  sub: undefined },
          { label: "В день",      value: `${fmt(revenuePerDay)} сум`,  icon: TrendingUp, delta: undefined, sub: `за ${days} дн.` },
          { label: "Средний чек", value: `${fmt(avgCheck)} сум`,       icon: CreditCard, delta: undefined, sub: undefined },
          { label: "Платежей",    value: String(count),                icon: BarChart2,  delta: undefined, sub: `~${days > 0 ? Math.round(count / days) : 0}/день` },
        ].map(({ label, value, icon: Icon, delta, sub }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
            {sub && <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{sub}</span>}
            {delta !== undefined && (
              <div className="flex items-center gap-1.5">
                {delta >= 0
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: delta >= 0 ? "#16a34a" : "#dc2626" }}>
                  {delta >= 0 ? "+" : ""}{delta}%
                </span>
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>vs пред.</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by day */}
        <SectionCard title="Выручка по дням" action={
          <div className="flex items-center gap-1.5">
            {revDelta !== 0 && (
              <>
                {revDelta >= 0
                  ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: revDelta >= 0 ? "#16a34a" : "#dc2626" }}>
                  {revDelta >= 0 ? "+" : ""}{revDelta}%
                </span>
              </>
            )}
            <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{fmt(revenue)} сум</span>
          </div>
        }>
          <div className="grid grid-cols-3 px-5 py-3 gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--gray-muted)" }}>Итого</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{fmtShort(revenue)} сум</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--gray-muted)" }}>В среднем / день</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{fmtShort(Math.round(revenue / days))} сум</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--gray-muted)" }}>Платежей</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{count} <span className="text-xs font-normal" style={{ color: "var(--gray-muted)" }}>шт.</span></p>
            </div>
          </div>
          <div style={{ height: 280, padding: "12px 8px 4px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} width={48} tickFormatter={fmtShort} />
                <Tooltip {...chartTooltipStyle} formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, "Выручка"]} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} fill="url(#rGrad)" dot={false} activeDot={{ r: 5, fill: "#2563eb", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Payment methods */}
        <SectionCard title="Способы оплаты" action={
          <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{providerData.length} метода</span>
        }>
          {providerData.length > 0 ? (
            <div className="flex flex-col">
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={providerData} dataKey="value"
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={3}
                      startAngle={90} endAngle={-270}
                    >
                      {providerData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, ""]}
                      contentStyle={chartTooltipStyle.contentStyle}
                      labelStyle={chartTooltipStyle.labelStyle}
                      itemStyle={chartTooltipStyle.itemStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 pb-5 flex flex-col gap-3">
                {providerData.sort((a, b) => b.value - a.value).map((p) => {
                  const share = revenue ? Math.round((p.value / revenue) * 100) : 0
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                          <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{fmt(p.value)} сум</span>
                          <span className="text-xs tabular-nums font-semibold w-8 text-right" style={{ color: p.color }}>{share}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: p.color }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--gray-muted)" }}>Итого выручка</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{fmt(revenue)} сум</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--gray-muted)" }}>Нет данных</p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ── 3. Sales Section ─────────────────────────────────────────────────

function SalesSection({ agg }: { agg: SalesAgg }) {
  const totalRev = agg.totalRevenue
  // byService уже отсортирован по revenue desc сервером; долю считаем так же, как раньше.
  const rows = agg.byService
    .map(({ name, count, revenue }) => ({ name, count, revenue, share: totalRev ? Math.round((revenue / totalRev) * 100) : 0 }))

  const CHART_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Продано",  value: String(agg.sold),      icon: CreditCard },
          { label: "Выручка",  value: `${fmt(totalRev)} сум`, icon: TrendingUp },
          { label: "Тарифов",  value: String(rows.length),    icon: BarChart2 },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={label}
            className={`p-5 flex flex-col gap-3 ${i > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`}
            style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="По тарифам">
          {rows.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>Нет продаж</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Тариф", "Продано", "Выручка", "Доля"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.name} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {r.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular-nums" style={{ color: "var(--on-dark-soft)" }}>{r.count}</td>
                      <td className="px-5 py-3 tabular-nums font-medium" style={{ color: "var(--on-dark)" }}>{fmt(r.revenue)} сум</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-2)", minWidth: 40 }}>
                            <div className="h-full rounded-full" style={{ width: `${r.share}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                          <span className="text-xs tabular-nums w-8 text-right" style={{ color: "var(--gray-muted)" }}>{r.share}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Топ тарифы">
          <div style={{ height: 260, padding: "8px 8px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} tickFormatter={fmtShort} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--on-dark-soft)" }} width={90} />
                <Tooltip {...chartTooltipStyle} formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, "Выручка"]} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {rows.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ── 4. Attendance Section ─────────────────────────────────────────────

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const HOURS_SHOW = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

function AttendanceSection({ agg, bounds }: {
  agg: VisitsAgg
  bounds: ReturnType<typeof periodBounds>
}) {
  const days = daysBetween(bounds.from, bounds.to)
  const total = agg.total
  const prevTotal = agg.prevTotal
  const avgPerDay = total / days

  const heatmap = agg.heatmap
  const maxCell = Math.max(1, ...heatmap.flatMap(row => row))

  // Busiest hour — суммируем heatmap по дням недели (эквивалент старому hourTotals)
  const hourTotals = Array(24).fill(0)
  for (let h = 0; h < 24; h++) for (let d = 0; d < 7; d++) hourTotals[h] += heatmap[d][h]
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals))

  // Quietest dow — суммируем heatmap по часам (эквивалент старому dowTotals)
  const dowTotals = heatmap.map(row => row.reduce((a, b) => a + b, 0))
  const quietDow = dowTotals.indexOf(Math.min(...dowTotals.filter(x => x > 0)))

  const visitsDelta = pct(total, prevTotal)

  const chartData = chartFromByDay(agg.byDay.map(d => ({ day: d.day, amount: d.count })))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Всего посещений",  value: fmt(total),                          icon: Activity,    delta: visitsDelta },
          { label: "В среднем в день", value: avgPerDay.toFixed(1),                icon: BarChart2,   delta: undefined },
          { label: "Пиковое время",    value: `${peakHour}:00–${peakHour+1}:00`,  icon: TrendingUp,  delta: undefined },
          { label: "Тихий день",       value: DOW_LABELS[quietDow] ?? "—",         icon: TrendingDown, delta: undefined },
        ].map(({ label, value, icon: Icon, delta }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
            {delta !== undefined && (
              <div className="flex items-center gap-1.5">
                {delta >= 0
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: delta >= 0 ? "#16a34a" : "#dc2626" }}>
                  {delta >= 0 ? "+" : ""}{delta}%
                </span>
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>vs пред.</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Посещения по дням">
          <div style={{ height: 220, padding: "8px 8px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} width={28} />
                <Tooltip {...chartTooltipStyle} formatter={(v) => [`${v} посещений`, ""]} />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} fill="url(#vGrad)" dot={false} activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Тепловая карта (час × день недели)">
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-1 mb-2" style={{ paddingLeft: 28 }}>
              {DOW_LABELS.map(d => (
                <div key={d} className="flex-1 text-center text-[10px] font-medium" style={{ color: "var(--gray-muted)", minWidth: 24 }}>{d}</div>
              ))}
            </div>
            {HOURS_SHOW.map(h => (
              <div key={h} className="flex items-center gap-1 mb-1">
                <div className="text-[10px] tabular-nums w-7 text-right pr-1 flex-shrink-0" style={{ color: "var(--gray-muted)" }}>{h}:00</div>
                {heatmap.map((row, dow) => {
                  const count = row[h] ?? 0
                  const intensity = count / maxCell
                  return (
                    <div key={dow} className="flex-1 rounded-sm" title={`${DOW_LABELS[dow]} ${h}:00 — ${count} посещ.`}
                      style={{ minWidth: 24, height: 16, background: intensity > 0 ? `rgba(37,99,235,${0.1 + intensity * 0.8})` : "var(--card-2)" }} />
                  )
                })}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ── 5. Renewals Section ───────────────────────────────────────────────

function RenewalsSection({ agg }: { agg: RenewalsAgg }) {
  const convRate = agg.expiring30 + agg.expired
    ? Math.round((agg.active / (agg.active + agg.expired)) * 100)
    : 100

  const expiryRows = agg.top

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Истекает до 30 дней", value: String(agg.expiring30), icon: RefreshCw,    sub: undefined },
          { label: "Истекает до 7 дней",  value: String(agg.expiring7),  icon: AlertTriangle, sub: undefined },
          { label: "Истёкших",            value: String(agg.expired),    icon: TrendingDown,  sub: undefined },
          { label: "Активных",            value: `${convRate}%`,         icon: TrendingUp,    sub: "абонементов активно" },
        ].map(({ label, value, icon: Icon, sub }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
            {sub && <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{sub}</span>}
          </div>
        ))}
      </div>

      <SectionCard title="Ближайшие истечения">
        {expiryRows.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>Нет истекающих абонементов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Клиент", "Абонемент", "Истекает через", "Статус"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiryRows.map((c) => {
                  const urgent = (c.daysLeft ?? 99) <= 3
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>{c.name}</td>
                      <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{c.membershipName ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: urgent ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.12)", color: urgent ? "#dc2626" : "#d97706" }}>
                          {c.daysLeft === 0 ? "Сегодня" : `${c.daysLeft} дн`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>Активный</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── 6. Clients Section ────────────────────────────────────────────────

function GenderCard({ gender }: { gender: { total: number; male: number; female: number } }) {
  const total   = gender.total
  const male    = gender.male
  const female  = gender.female
  const unknown = total - male - female

  const malePct   = total ? Math.round((male   / total) * 100) : 0
  const femalePct = total ? Math.round((female / total) * 100) : 0

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Пол клиентов</p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Thin proportional bar */}
        <div className="flex h-2 rounded-full overflow-hidden gap-px" style={{ background: "var(--card-2)" }}>
          {malePct > 0 && (
            <div className="h-full rounded-l-full transition-all" style={{ width: `${malePct}%`, background: "#3b82f6" }} />
          )}
          {femalePct > 0 && (
            <div className="h-full rounded-r-full transition-all" style={{ width: `${femalePct}%`, background: "#ec4899", marginLeft: "auto" }} />
          )}
        </div>

        {/* Two equal panels — always same size, looks good at any ratio */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-4 flex flex-col items-center gap-1.5"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
            <span className="text-xl leading-none" style={{ color: "#3b82f6" }}>♂</span>
            <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: "#2563eb" }}>{male}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>
              {malePct}%
            </span>
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>мужчин</span>
          </div>

          <div className="rounded-lg p-4 flex flex-col items-center gap-1.5"
            style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.18)" }}>
            <span className="text-xl leading-none" style={{ color: "#ec4899" }}>♀</span>
            <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: "#db2777" }}>{female}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(236,72,153,0.12)", color: "#db2777" }}>
              {femalePct}%
            </span>
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>женщин</span>
          </div>
        </div>

        {/* Unknown — compact footnote */}
        {unknown > 0 && (
          <div className="flex items-center justify-between px-1 pt-0.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-xs" style={{ color: "var(--gray-muted)" }}>Пол не указан</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--on-dark-soft)" }}>{unknown}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientsSection({ agg }: { agg: ClientsAgg }) {
  const newDelta    = pct(agg.newInPeriod, agg.prevNew)

  const sourceRows = agg.bySource
    .map(({ key, count }) => ({ key, label: SOURCE_LABELS[key] ?? key, count, color: SOURCE_COLORS[key] ?? "#6b7280" }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Новых клиентов", value: String(agg.newInPeriod), icon: Users,        delta: newDelta },
          { label: "Всего клиентов", value: String(agg.total),       icon: Users,        delta: undefined },
          { label: "Активных",       value: String(agg.active),      icon: TrendingUp,   delta: undefined },
          { label: "С истёкшим",     value: String(agg.expired),     icon: TrendingDown, delta: undefined },
        ].map(({ label, value, icon: Icon, delta }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
            {delta !== undefined && (
              <div className="flex items-center gap-1.5">
                {delta >= 0
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: delta >= 0 ? "#16a34a" : "#dc2626" }}>
                  {delta >= 0 ? "+" : ""}{delta}%
                </span>
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>vs пред.</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gender */}
        <GenderCard gender={agg.gender} />

        {/* Sources */}
        <SectionCard title={`Источники (${agg.newInPeriod} новых)`}>
          {sourceRows.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>Нет данных об источниках</p>
          ) : (
            <div className="p-5 flex flex-col gap-3">
              {sourceRows.map(s => (
                <div key={s.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{s.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-2)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${agg.newInPeriod ? (s.count / agg.newInPeriod) * 100 : 0}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* New clients chart */}
        <SectionCard title="Новые клиенты в период">
          <div style={{ height: 260, padding: "8px 8px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartFromByDay(agg.byDayNew.map(d => ({ day: d.day, amount: d.count })))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} width={24} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} formatter={(v) => [`${v} клиентов`, ""]} />
                <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ── 7. Staff Section ──────────────────────────────────────────────────

function StaffSection({ staff }: { staff: ReportClient[] | any[] }) {
  return (
    <SectionCard title="Сотрудники">
      {staff.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>Сотрудников нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Сотрудник", "Роль", "Клиентов", "Зарплата", "Статус"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => {
                const sm = STATUS_META[s.status] ?? STATUS_META.active
                return (
                  <tr key={s.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: "#3b82f6" }}>
                          {(s.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium" style={{ color: "var(--on-dark)" }}>{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>{s.clientCount > 0 ? s.clientCount : "—"}</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{s.salary > 0 ? `${fmt(s.salary)} сум` : "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ── 8. Debts Section ──────────────────────────────────────────────────

function DebtsSection({ agg }: { agg: DebtsAgg }) {
  const total = agg.total

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          { label: "Должников",  value: String(agg.count), icon: AlertTriangle },
          { label: "Общий долг", value: `${fmt(total)} сум`,  icon: Wallet },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
          </div>
        ))}
      </div>

      <SectionCard title="Список долгов">
        {agg.count === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>Долгов нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Клиент", "Телефон", "Сумма", "Дата"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agg.list.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>{p.clientName ?? "—"}</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{p.clientPhone ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: "#dc2626" }}>{fmt(p.amount)} сум</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--gray-muted)" }}>
                      {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── 9. AI Section ─────────────────────────────────────────────────────

function AiSection({ finance, sales, visits, alerts, bounds }: {
  finance: FinanceAgg
  sales: SalesAgg
  visits: VisitsAgg
  alerts: AlertsAgg
  bounds: ReturnType<typeof periodBounds>
}) {
  const insights = useMemo(() => {
    const result: Array<{ icon: string; title: string; detail: string; level: "info" | "warning" | "success" }> = []

    const revenue = finance.revenue

    // Most popular membership (по числу продаж)
    const topService = [...sales.byService].sort((a, b) => b.count - a.count)[0]
    if (topService) result.push({ icon: "🏆", title: `Топ тариф: ${topService.name}`, detail: `Продан ${topService.count} раз — самый популярный в выбранном периоде`, level: "success" })

    // Peak hour — из heatmap (сумма по дням недели)
    const hourTotals = Array(24).fill(0)
    for (let h = 0; h < 24; h++) for (let d = 0; d < 7; d++) hourTotals[h] += visits.heatmap[d][h]
    const peakH = hourTotals.indexOf(Math.max(...hourTotals))
    if (visits.total > 0) result.push({ icon: "⏰", title: `Пиковое время: ${peakH}:00–${peakH + 1}:00`, detail: `${hourTotals[peakH]} посещений в этот час — планируйте персонал заранее`, level: "info" })

    // At-risk clients
    if (alerts.atRiskCount > 0) result.push({ icon: "⚠️", title: `${alerts.atRiskCount} клиентов под угрозой оттока`, detail: `Активный абонемент, но не приходили 14+ дней. Свяжитесь с ними.`, level: "warning" })

    // Payment method
    const topProvider = [...finance.byProvider].sort((a, b) => b.amount - a.amount)[0]
    if (topProvider) {
      const share = revenue ? Math.round((topProvider.amount / revenue) * 100) : 0
      const PROVIDER_LABELS: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
      result.push({ icon: "💳", title: `${PROVIDER_LABELS[topProvider.provider] ?? topProvider.provider}: ${share}% выручки`, detail: `Основной способ оплаты в выбранном периоде`, level: "info" })
    }

    // Expiring
    if (alerts.expiringSoonCount > 0) result.push({ icon: "🔔", title: `${alerts.expiringSoonCount} абонементов истекают через 3 дня`, detail: `Отправьте напоминание для продления`, level: "warning" })

    // Revenue insight
    if (revenue > 0) {
      const avgPerDay = revenue / daysBetween(bounds.from, bounds.to)
      result.push({ icon: "📈", title: `Средняя выручка в день: ${fmt(Math.round(avgPerDay))} сум`, detail: `На основе периода ${finance.count} платежей`, level: "success" })
    }

    return result
  }, [finance, sales, visits, alerts, bounds])

  // Вход для AI-прогноза (те же деривации, что и в insights)
  const forecastInput = useMemo<ForecastInput>(() => {
    const hourTotals = Array(24).fill(0)
    for (let h = 0; h < 24; h++) for (let d = 0; d < 7; d++) hourTotals[h] += visits.heatmap[d][h]
    const peakH = visits.total > 0 ? hourTotals.indexOf(Math.max(...hourTotals)) : null
    const topService = [...sales.byService].sort((a, b) => b.count - a.count)[0]
    const topProvider = [...finance.byProvider].sort((a, b) => b.amount - a.amount)[0]
    const PROVIDER_LABELS: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
    const days = daysBetween(bounds.from, bounds.to)
    return {
      periodLabel: `${days} дн.`, days,
      revenue: finance.revenue, prevRevenue: finance.prevRevenue, payments: finance.count,
      avgPerDay: finance.revenue / Math.max(1, days),
      topService: topService?.name ?? null,
      peakHour: peakH,
      atRisk: alerts.atRiskCount, expiringSoon: alerts.expiringSoonCount, visits: visits.total,
      topProvider: topProvider ? (PROVIDER_LABELS[topProvider.provider] ?? topProvider.provider) : null,
    }
  }, [finance, sales, visits, alerts, bounds])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--card-2)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "#7c3aed" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>AI Аналитика</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>Выводы на основе реальных данных за выбранный период</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.map((ins, i) => (
          <div key={i} className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: "var(--card-2)" }}>{ins.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{ins.title}</p>
                <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{ins.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ForecastBlock input={forecastInput} />
    </div>
  )
}

// ── AI-прогноз и рекомендации (Gemini) ───────────────────────────────────
function ForecastBlock({ input }: { input: ForecastInput }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ forecast: string; recommendations: string[] } | null>(null)

  async function generate() {
    setLoading(true)
    const res = await getReportsForecastAction(input)
    if (!res.error) setData({ forecast: res.forecast, recommendations: res.recommendations })
    setLoading(false)
  }

  if (!data) {
    return (
      <div className="rounded-lg p-6 text-center flex flex-col items-center gap-2"
        style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
        <Sparkles className="w-6 h-6" style={{ color: "#7c3aed" }} />
        <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>AI-прогноз выручки и рекомендации</p>
        <p className="text-xs" style={{ color: "var(--gray-muted)" }}>На основе ваших данных за выбранный период</p>
        <button onClick={generate} disabled={loading}
          className="mt-2 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Анализирую…" : "Сгенерировать прогноз"}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--card-2)" }}>
            <Sparkles className="w-5 h-5" style={{ color: "#7c3aed" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Прогноз и рекомендации</p>
        </div>
        <button onClick={generate} disabled={loading} title="Обновить"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--on-dark-soft)" }} />
        </button>
      </div>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{data.forecast}</p>
      <div className="flex flex-col gap-2">
        {data.recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}>{i + 1}</span>
            <span className="text-sm" style={{ color: "var(--on-dark)" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "today", label: "Сегодня" },
  { key: "7d",    label: "7 дней" },
  { key: "30d",   label: "30 дней" },
  { key: "90d",   label: "90 дней" },
  { key: "year",  label: "Год" },
]

const SECTIONS: Array<{ key: Section; label: string; icon: typeof Activity }> = [
  { key: "alerts",   label: "Внимание",    icon: AlertTriangle },
  { key: "finance",  label: "Финансы",     icon: TrendingUp },
  { key: "sales",    label: "Продажи",     icon: CreditCard },
  { key: "visits",   label: "Посещения",   icon: Activity },
  { key: "renewals", label: "Продления",   icon: RefreshCw },
  { key: "clients",  label: "Клиенты",     icon: Users },
  { key: "staff",    label: "Сотрудники",  icon: UserCog },
  { key: "debts",    label: "Долги",       icon: Wallet },
  { key: "ai",       label: "AI",          icon: Sparkles },
]

const PERIOD_LABELS: Record<string, string> = {
  today: "Сегодня", "7d": "7 дней", "30d": "30 дней", "90d": "90 дней", year: "Год",
}
const GENDER_LABELS_RU: Record<string, string> = { male: "Мужской", female: "Женский" }
const STATUS_LABELS_RU: Record<string, string> = {
  paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат",
  active: "Активный", expired: "Истёк", frozen: "Заморожен", none: "Нет",
}
const PROVIDER_LABELS_RU: Record<string, string> = {
  cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum",
}

function tbl(headers: string[], rows: string[][]): string {
  const th = headers.map(h => `<th>${h}</th>`).join("")
  const tr = rows.map(r =>
    `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`
  ).join("")
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
}

function kpiGrid(items: Array<{ label: string; value: string; sub?: string }>): string {
  return `<div class="kpi-grid">${items.map(k => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ""}
    </div>`).join("")}</div>`
}

function printPdf(
  data: ReportsData,
  paidPayments: ReportPayment[],
  periodVisits: Array<{ clientId: string; checkedInAt: string }>,
  debts: ReportPayment[],
  period: string,
) {
  const stamp     = new Date().toLocaleDateString("ru-RU")
  const revenue   = paidPayments.reduce((a, p) => a + p.amount, 0)
  const avgCheck  = paidPayments.length ? Math.round(revenue / paidPayments.length) : 0
  const active    = data.clients.filter(c => c.status === "active").length
  const expired   = data.clients.filter(c => c.status === "expired").length
  const debtTotal = debts.reduce((a, p) => a + p.amount, 0)
  const male      = data.clients.filter(c => c.gender === "male").length
  const female    = data.clients.filter(c => c.gender === "female").length

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>FitCRM — Отчёт (${PERIOD_LABELS[period] ?? period})</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0f172a; background: #fff }
  .page-header { background: #2563eb; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px }
  .page-header h1 { font-size: 15px; font-weight: 700; letter-spacing: -0.02em }
  .page-header span { font-size: 10px; opacity: 0.85 }
  .content { padding: 0 20px 20px }
  h2 { font-size: 12px; font-weight: 700; color: #1e40af; border-bottom: 1.5px solid #2563eb; padding-bottom: 4px; margin: 20px 0 10px }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc }
  .kpi-label { font-size: 9px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em }
  .kpi-value { font-size: 14px; font-weight: 700; color: #0f172a }
  .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 2px }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px }
  thead tr { background: #2563eb; color: #fff }
  th { padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top }
  tr:nth-child(even) td { background: #f8fafc }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 9px; font-weight: 600 }
  .badge-green { background: rgba(22,163,74,.12); color: #16a34a }
  .badge-red { background: rgba(220,38,38,.12); color: #dc2626 }
  .badge-amber { background: rgba(217,119,6,.12); color: #d97706 }
  .badge-blue { background: rgba(37,99,235,.12); color: #2563eb }
  .right { text-align: right }
  .note { font-size: 9px; color: #94a3b8; margin-top: 4px }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
    .page-header { background: #2563eb !important; color: #fff !important }
    thead tr { background: #2563eb !important; color: #fff !important }
    .page-break { page-break-before: always }
  }
</style>
</head>
<body>
<div class="page-header">
  <h1>FitCRM — Отчёт</h1>
  <span>Период: ${PERIOD_LABELS[period] ?? period} &nbsp;|&nbsp; Сформирован: ${stamp}</span>
</div>
<div class="content">

<h2>Сводка</h2>
${kpiGrid([
  { label: "Выручка", value: revenue.toLocaleString("ru-RU") + " сум" },
  { label: "Платежей", value: String(paidPayments.length), sub: avgCheck ? `ср. чек ${avgCheck.toLocaleString("ru-RU")} сум` : undefined },
  { label: "Посещений", value: String(periodVisits.length) },
  { label: "Всего клиентов", value: String(data.clients.length), sub: `активных: ${active}` },
  { label: "Мужчин / Женщин", value: `${male} / ${female}` },
  { label: "Истёкших", value: String(expired) },
  { label: "Долгов", value: String(debts.length), sub: debtTotal ? `${debtTotal.toLocaleString("ru-RU")} сум` : undefined },
  { label: "Сотрудников", value: String(data.staff.length) },
])}

<h2>Оплаты за период (${paidPayments.length})</h2>
${paidPayments.length === 0 ? "<p class='note'>Нет оплат за выбранный период</p>" :
  tbl(
    ["Дата", "Клиент", "Услуга", "Сумма", "Способ оплаты"],
    paidPayments.slice(0, 200).map(p => [
      p.paidAt ? new Date(p.paidAt).toLocaleDateString("ru-RU") : "—",
      p.clientName ?? "—",
      p.serviceName ?? "—",
      `<span class="right">${p.amount.toLocaleString("ru-RU")} сум</span>`,
      PROVIDER_LABELS_RU[p.provider] ?? p.provider,
    ])
  )
}
${paidPayments.length > 200 ? `<p class="note">Показаны первые 200 из ${paidPayments.length}</p>` : ""}

<div class="page-break"></div>
<div class="page-header">
  <h1>FitCRM — Отчёт</h1>
  <span>Период: ${PERIOD_LABELS[period] ?? period} &nbsp;|&nbsp; Сформирован: ${stamp}</span>
</div>

<h2>Клиенты (${data.clients.length})</h2>
${tbl(
  ["Имя", "Телефон", "Пол", "Статус", "Абонемент", "Источник"],
  data.clients.slice(0, 300).map(c => {
    const statusClass = c.status === "active" ? "badge-green" : c.status === "expired" ? "badge-red" : c.status === "frozen" ? "badge-blue" : ""
    return [
      `<strong>${c.name}</strong>`,
      c.phone ?? "—",
      GENDER_LABELS_RU[c.gender ?? ""] ?? "—",
      statusClass ? `<span class="badge ${statusClass}">${STATUS_LABELS_RU[c.status] ?? c.status}</span>` : (STATUS_LABELS_RU[c.status] ?? c.status),
      c.membershipName ?? "—",
      c.source ?? "—",
    ]
  })
)}
${data.clients.length > 300 ? `<p class="note">Показаны первые 300 из ${data.clients.length}</p>` : ""}

${debts.length > 0 ? `
<h2>Долги — неоплаченные счета (${debts.length})</h2>
${tbl(
  ["Клиент", "Телефон", "Сумма", "Дата"],
  debts.slice(0, 100).map(p => [
    p.clientName ?? "—",
    p.clientPhone ?? "—",
    `<span class="badge badge-red">${p.amount.toLocaleString("ru-RU")} сум</span>`,
    new Date(p.createdAt).toLocaleDateString("ru-RU"),
  ])
)}
<p class="note">Итого долг: <strong>${debtTotal.toLocaleString("ru-RU")} сум</strong></p>
` : ""}

${data.staff.length > 0 ? `
<h2>Сотрудники (${data.staff.length})</h2>
${tbl(
  ["Имя", "Роль", "Клиентов", "Зарплата (сум)", "Статус"],
  data.staff.map(s => {
    const sc = s.status === "active" ? "badge-green" : s.status === "fired" ? "badge-red" : "badge-amber"
    return [
      `<strong>${s.name}</strong>`,
      ROLE_LABELS[s.role] ?? s.role,
      s.clientCount > 0 ? String(s.clientCount) : "—",
      s.salary > 0 ? s.salary.toLocaleString("ru-RU") : "—",
      `<span class="badge ${sc}">${s.status === "active" ? "Активен" : s.status === "vacation" ? "Отпуск" : "Уволен"}</span>`,
    ]
  })
)}
` : ""}

</div>
<script>window.addEventListener("load", () => { window.print() })</script>
</body>
</html>`

  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) { alert("Разрешите всплывающие окна для экспорта PDF"); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export function ReportsClient() {
  const [period,  setPeriod]  = useState<Period>("30d")
  const [section, setSection] = useState<Section>("alerts")

  const bounds = useMemo(() => periodBounds(period), [period])

  // Stage 1: финансовая вкладка — серверная агрегация (RPC), загрузка per-период.
  // Серверная агрегация вкладок — ленивая загрузка при открытии вкладки + смене периода.
  const [financeAgg, setFinanceAgg] = useState<FinanceAgg | null>(null)
  useEffect(() => {
    if (section !== "finance" && section !== "ai") return
    let cancelled = false
    setFinanceAgg(null)
    loadFinanceAction(bounds.from, bounds.to, bounds.prevFrom, bounds.prevTo)
      .then((a) => { if (!cancelled) setFinanceAgg(a) })
      .catch(() => { if (!cancelled) setFinanceAgg(null) })
    return () => { cancelled = true }
  }, [section, bounds])

  const [salesAgg, setSalesAgg] = useState<SalesAgg | null>(null)
  useEffect(() => {
    if (section !== "sales" && section !== "ai") return
    let cancelled = false
    setSalesAgg(null)
    loadSalesAction(bounds.from, bounds.to)
      .then((a) => { if (!cancelled) setSalesAgg(a) })
      .catch(() => { if (!cancelled) setSalesAgg(null) })
    return () => { cancelled = true }
  }, [section, bounds])

  const [visitsAgg, setVisitsAgg] = useState<VisitsAgg | null>(null)
  useEffect(() => {
    if (section !== "visits" && section !== "alerts" && section !== "ai") return
    let cancelled = false
    setVisitsAgg(null)
    loadVisitsAction(bounds.from, bounds.to, bounds.prevFrom, bounds.prevTo)
      .then((a) => { if (!cancelled) setVisitsAgg(a) })
      .catch(() => { if (!cancelled) setVisitsAgg(null) })
    return () => { cancelled = true }
  }, [section, bounds])

  const [clientsAgg, setClientsAgg] = useState<ClientsAgg | null>(null)
  useEffect(() => {
    if (section !== "clients") return
    let cancelled = false
    setClientsAgg(null)
    loadClientsAction(bounds.from, bounds.to, bounds.prevFrom, bounds.prevTo)
      .then((a) => { if (!cancelled) setClientsAgg(a) })
      .catch(() => { if (!cancelled) setClientsAgg(null) })
    return () => { cancelled = true }
  }, [section, bounds])

  // Продления не зависят от периода (текущий срез).
  const [renewalsAgg, setRenewalsAgg] = useState<RenewalsAgg | null>(null)
  useEffect(() => {
    if (section !== "renewals") return
    let cancelled = false
    setRenewalsAgg(null)
    loadRenewalsAction()
      .then((a) => { if (!cancelled) setRenewalsAgg(a) })
      .catch(() => { if (!cancelled) setRenewalsAgg(null) })
    return () => { cancelled = true }
  }, [section])

  // Долги не зависят от периода.
  const [debtsAgg, setDebtsAgg] = useState<DebtsAgg | null>(null)
  useEffect(() => {
    if (section !== "debts") return
    let cancelled = false
    setDebtsAgg(null)
    loadDebtsAction()
      .then((a) => { if (!cancelled) setDebtsAgg(a) })
      .catch(() => { if (!cancelled) setDebtsAgg(null) })
    return () => { cancelled = true }
  }, [section])

  // Персонал не зависит от периода.
  const [staffAgg, setStaffAgg] = useState<ReportStaffRow[] | null>(null)
  useEffect(() => {
    if (section !== "staff") return
    let cancelled = false
    setStaffAgg(null)
    loadStaffAction()
      .then((a) => { if (!cancelled) setStaffAgg(a) })
      .catch(() => { if (!cancelled) setStaffAgg(null) })
    return () => { cancelled = true }
  }, [section])

  // «Внимание» — период-независимое ядро; грузим на маунте (нужно и для бейджа вкладки).
  const [alertsAgg, setAlertsAgg] = useState<AlertsAgg | null>(null)
  useEffect(() => {
    let cancelled = false
    loadAlertsAction()
      .then((a) => { if (!cancelled) setAlertsAgg(a) })
      .catch(() => { if (!cancelled) setAlertsAgg(null) })
    return () => { cancelled = true }
  }, [])

  const alertsCount = alertsAgg
    ? alertsAgg.expiringSoonCount + (alertsAgg.debtsCount > 0 ? 1 : 0)
    : 0

  function navigate(s: Section) { setSection(s); window.scrollTo({ top: 0, behavior: "smooth" }) }

  // Экспорт грузит сырые данные по требованию (не на каждый заход в отчёты).
  const [exporting, setExporting] = useState<null | "pdf" | "csv">(null)

  async function handlePdf() {
    if (exporting) return
    setExporting("pdf")
    try {
      const data = await loadReportsDataAction()
      if (!data) { alert("Не удалось загрузить данные для экспорта"); return }
      const paidPayments = data.payments.filter(p => p.status === "paid" && p.paidAt && p.paidAt >= bounds.from && p.paidAt <= bounds.to)
      const periodVisits = data.visits.filter(v => v.checkedInAt >= bounds.from && v.checkedInAt <= bounds.to)
      const debts = data.payments.filter(p => p.status === "pending")
      printPdf(data, paidPayments, periodVisits, debts, period)
    } finally {
      setExporting(null)
    }
  }

  async function handleExcel() {
    if (exporting) return
    setExporting("csv")
    try {
      const data = await loadReportsDataAction()
      if (!data) { alert("Не удалось загрузить данные для экспорта"); return }
      const paidPayments = data.payments.filter(p => p.status === "paid" && p.paidAt && p.paidAt >= bounds.from && p.paidAt <= bounds.to)
      const today = new Date().toISOString().slice(0, 10)

    // Sheet 1: payments
    const paymentRows = paidPayments.map((p) => [
      p.paidAt ? new Date(p.paidAt).toLocaleDateString("ru-RU") : "—",
      p.clientName ?? "—",
      p.clientPhone ?? "—",
      p.serviceName ?? "—",
      p.amount,
      { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }[p.provider] ?? p.provider,
      { paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат" }[p.status] ?? p.status,
    ])

    downloadCSV(`report_payments_${period}_${today}.csv`,
      ["Дата", "Клиент", "Телефон", "Услуга", "Сумма (сум)", "Способ оплаты", "Статус"],
      paymentRows,
    )

    // Sheet 2: clients (separate file)
    setTimeout(() => {
      downloadCSV(`report_clients_${period}_${today}.csv`,
        ["Имя", "Телефон", "Статус", "Абонемент", "Дней осталось", "Источник"],
        data.clients.map((c) => [
          c.name,
          c.phone ?? "—",
          { active: "Активный", expired: "Истёк", frozen: "Заморожен" }[c.status] ?? c.status,
          c.membershipName ?? "—",
          c.daysLeft ?? "—",
          c.source ?? "—",
        ]),
      )
    }, 300)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold tracking-[-0.144px]" style={{ fontSize: 24, color: "var(--on-dark)" }}>Отчёты</h1>
          <p style={{ fontSize: 15, color: "var(--on-dark-soft)", marginTop: 2 }}>Аналитика и статистика клуба</p>
        </div>
        <div className="grid w-full grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-center gap-2 pt-1 sm:flex sm:w-auto sm:flex-shrink-0">
          <button
            onClick={handleExcel}
            disabled={exporting !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60 sm:w-auto sm:px-4"
            style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}>
            <Download className="w-4 h-4" /> {exporting === "csv" ? "Готовим…" : "Экспорт в CSV"}
          </button>
          <button
            onClick={handlePdf}
            disabled={exporting !== null}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60 sm:w-auto sm:px-4"
            style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}>
            <Download className="w-4 h-4" /> {exporting === "pdf" ? "Готовим…" : "PDF"}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Section tabs */}
        <div className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg p-1 sm:flex-1" style={{ background: "var(--card-2)" }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1"
              style={{
                background: section === s.key ? "var(--pill-active)" : "transparent",
                color: section === s.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                boxShadow: section === s.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}>
              {s.label}
              {s.key === "alerts" && alertsCount > 0 && (
                <span className="ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                  style={{ background: "var(--destructive)" }}>
                  {alertsCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Period picker */}
        <div className="grid w-full grid-cols-5 gap-0.5 rounded-lg p-1 sm:flex sm:w-auto sm:flex-shrink-0 sm:items-center" style={{ background: "var(--card-2)" }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="flex h-7 min-w-0 items-center justify-center rounded-md px-1 text-[11px] font-medium transition-all whitespace-nowrap sm:block sm:px-3 sm:text-xs"
              style={{
                background: period === p.key ? "var(--pill-active)" : "transparent",
                color: period === p.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                boxShadow: period === p.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {section === "alerts"   && (alertsAgg && visitsAgg
        ? <AlertsSection agg={alertsAgg} visitsDelta={pct(visitsAgg.total, visitsAgg.prevTotal)} onNavigate={navigate} />
        : <SectionLoading />)}
      {section === "finance"  && (financeAgg ? <FinanceSection agg={financeAgg} bounds={bounds} /> : <SectionLoading />)}
      {section === "sales"    && (salesAgg ? <SalesSection agg={salesAgg} /> : <SectionLoading />)}
      {section === "visits"   && (visitsAgg ? <AttendanceSection agg={visitsAgg} bounds={bounds} /> : <SectionLoading />)}
      {section === "renewals" && (renewalsAgg ? <RenewalsSection agg={renewalsAgg} /> : <SectionLoading />)}
      {section === "clients"  && (clientsAgg ? <ClientsSection agg={clientsAgg} /> : <SectionLoading />)}
      {section === "staff"    && (staffAgg ? <StaffSection staff={staffAgg} /> : <SectionLoading />)}
      {section === "debts"    && (debtsAgg ? <DebtsSection agg={debtsAgg} /> : <SectionLoading />)}
      {section === "ai"       && (financeAgg && salesAgg && visitsAgg && alertsAgg
        ? <AiSection finance={financeAgg} sales={salesAgg} visits={visitsAgg} alerts={alertsAgg} bounds={bounds} />
        : <SectionLoading />)}

    </div>
  )
}
