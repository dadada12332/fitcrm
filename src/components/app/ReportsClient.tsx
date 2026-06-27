"use client"

import { useState, useMemo } from "react"
import {
  AlertTriangle, TrendingUp, TrendingDown, CreditCard,
  Activity, Users, UserCog, Wallet, Sparkles, RefreshCw,
  ArrowRight, Download, CheckCircle2, BarChart2,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts"
import type { ReportsData, ReportPayment, ReportClient } from "@/lib/reports"

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

function aggregateByDay(
  items: Array<{ date: string; amount: number }>,
  from: string,
  to: string,
): Array<{ label: string; value: number }> {
  const days: Record<string, number> = {}
  const cur = new Date(from.slice(0, 10))
  const end = new Date(to.slice(0, 10))
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10)
    days[key] = 0
    cur.setDate(cur.getDate() + 1)
  }
  for (const item of items) {
    const key = item.date.slice(0, 10)
    if (key in days) days[key] = (days[key] || 0) + item.amount
  }
  const total = Object.keys(days).length
  const step = total <= 14 ? 1 : total <= 60 ? 2 : 7
  return Object.entries(days)
    .filter((_, i) => i % step === 0 || i === Object.keys(days).length - 1)
    .map(([date, value]) => ({ label: date.slice(5).replace("-", "."), value }))
}

// heatmap: grid[dow][hour] = count, dow 0=Mon, hour 0-23
function buildHeatmap(visits: Array<{ checkedInAt: string }>) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const v of visits) {
    const d = new Date(v.checkedInAt)
    const dow = (d.getDay() + 6) % 7 // Mon=0
    const h   = d.getHours()
    grid[dow][h]++
  }
  return grid
}

// ── Shared sub-components ─────────────────────────────────────────────

function KpiCard({ label, value, sub, delta, icon: Icon, accent }: {
  label: string; value: string; sub?: string; delta?: number
  icon?: typeof TrendingUp; accent?: string
}) {
  const up = delta !== undefined && delta >= 0
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accent ? `${accent}18` : "var(--card-2)" }}>
            <Icon className="w-4 h-4" style={{ color: accent ?? "var(--on-dark-soft)" }} />
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none" style={{ color: "var(--on-dark)" }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{sub}</p>}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          {up ? <TrendingUp className="w-3 h-3" style={{ color: "#16a34a" }} /> : <TrendingDown className="w-3 h-3" style={{ color: "#dc2626" }} />}
          <span className="text-xs font-semibold" style={{ color: up ? "#16a34a" : "#dc2626" }}>
            {up ? "+" : ""}{delta}%
          </span>
          <span className="text-xs" style={{ color: "var(--gray-muted)" }}>vs пред. период</span>
        </div>
      )}
    </div>
  )
}

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
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── 1. Alerts Section ────────────────────────────────────────────────

function AlertItem({ level, text, sub, onClick }: {
  level: "high" | "medium" | "low"
  text: string; sub?: string; onClick?: () => void
}) {
  const colors = {
    high:   { bg: "rgba(220,38,38,0.06)",  border: "rgba(220,38,38,0.22)", icon: "#dc2626", chip: "rgba(220,38,38,0.12)", label: "Срочно" },
    medium: { bg: "rgba(217,119,6,0.06)",  border: "rgba(217,119,6,0.22)", icon: "#d97706", chip: "rgba(217,119,6,0.12)", label: "Внимание" },
    low:    { bg: "rgba(22,163,74,0.06)",  border: "rgba(22,163,74,0.20)", icon: "#16a34a", chip: "rgba(22,163,74,0.12)", label: "В норме" },
  }[level]
  const Icon = level === "low" ? CheckCircle2 : AlertTriangle
  const interactive = !!onClick

  return (
    <button
      onClick={onClick}
      disabled={!interactive}
      className="group flex h-full flex-col gap-3 rounded-2xl p-4 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ background: colors.chip }}>
          <Icon className="h-[18px] w-[18px]" style={{ color: colors.icon }} />
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.chip, color: colors.icon }}>
          {colors.label}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--on-dark)" }}>{text}</p>
        {sub && <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{sub}</p>}
      </div>
      {interactive && (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: colors.icon }}>
          Открыть
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </button>
  )
}

function AlertsSection({ data, bounds, onNavigate }: {
  data: ReportsData
  bounds: ReturnType<typeof periodBounds>
  onNavigate: (s: Section) => void
}) {
  const lastVisitByClient = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of data.visits) {
      if (!map[v.clientId] || v.checkedInAt > map[v.clientId]) {
        map[v.clientId] = v.checkedInAt
      }
    }
    return map
  }, [data.visits])

  const expiringSoon = data.clients.filter(c =>
    c.status === "active" && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 3
  )
  const expiring7   = data.clients.filter(c =>
    c.status === "active" && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 7
  )

  const cutoff14 = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const atRisk = data.clients.filter(c => {
    if (c.status !== "active") return false
    const lv = lastVisitByClient[c.id]
    return !lv || lv < cutoff14
  })

  const debts = data.payments.filter(p => p.status === "pending")
  const debtTotal = debts.reduce((a, p) => a + p.amount, 0)

  const curVisits  = data.visits.filter(v => v.checkedInAt >= bounds.from && v.checkedInAt <= bounds.to)
  const prevVisits = data.visits.filter(v => v.checkedInAt >= bounds.prevFrom && v.checkedInAt < bounds.prevTo)
  const visitsDelta = pct(curVisits.length, prevVisits.length)

  const alerts: Array<{ level: "high" | "medium" | "low"; text: string; sub?: string; section?: Section }> = []

  if (expiringSoon.length > 0)
    alerts.push({ level: "high", text: `${expiringSoon.length} абонементов истекает в ближайшие 3 дня`, sub: expiringSoon.slice(0, 3).map(c => c.name).join(", ") + (expiringSoon.length > 3 ? ` и ещё ${expiringSoon.length - 3}` : ""), section: "renewals" })
  else if (expiring7.length > 0)
    alerts.push({ level: "medium", text: `${expiring7.length} абонементов истекает в ближайшие 7 дней`, section: "renewals" })

  if (atRisk.length > 0)
    alerts.push({ level: "medium", text: `${atRisk.length} клиентов не приходили более 14 дней`, sub: "Риск оттока — стоит связаться", section: "clients" })

  if (debts.length > 0)
    alerts.push({ level: "high", text: `${debts.length} неоплаченных счетов на ${fmt(debtTotal)} сум`, sub: "Требуют напоминания", section: "debts" })

  if (visitsDelta < -10)
    alerts.push({ level: "medium", text: `Посещаемость снизилась на ${Math.abs(visitsDelta)}%`, sub: "По сравнению с предыдущим периодом", section: "visits" })
  else if (visitsDelta > 15)
    alerts.push({ level: "low", text: `Посещаемость выросла на ${visitsDelta}%`, sub: "Отличная динамика!", section: "visits" })

  if (alerts.length === 0)
    alerts.push({ level: "low", text: "Всё в порядке", sub: "Критических событий нет" })

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Истекает в 3 дня"   value={String(expiringSoon.length)} icon={AlertTriangle} accent="#dc2626" />
        <KpiCard label="Не приходили 14+ дн" value={String(atRisk.length)}      icon={Users}          accent="#d97706" />
        <KpiCard label="Долгов"              value={String(debts.length)}        sub={debts.length ? `${fmt(debtTotal)} сум` : undefined} icon={Wallet} accent="#dc2626" />
        <KpiCard label="Посещаемость"        value={`${visitsDelta > 0 ? "+" : ""}${visitsDelta}%`} icon={Activity} accent={visitsDelta >= 0 ? "#16a34a" : "#dc2626"} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((a, i) => (
          <AlertItem key={i} level={a.level} text={a.text} sub={a.sub}
            onClick={a.section ? () => onNavigate(a.section!) : undefined} />
        ))}
      </div>
    </div>
  )
}

// ── 2. Finance Section ────────────────────────────────────────────────

function FinanceSection({ payments, prevPayments, bounds }: {
  payments: ReportPayment[]
  prevPayments: ReportPayment[]
  bounds: ReturnType<typeof periodBounds>
}) {
  const revenue     = payments.reduce((a, p) => a + p.amount, 0)
  const prevRevenue = prevPayments.reduce((a, p) => a + p.amount, 0)
  const revDelta    = pct(revenue, prevRevenue)
  const profit      = Math.round(revenue * 0.7)
  const expenses    = revenue - profit
  const avgCheck    = payments.length ? Math.round(revenue / payments.length) : 0
  const days        = daysBetween(bounds.from, bounds.to)

  const chartData = aggregateByDay(
    payments.map(p => ({ date: p.paidAt ?? p.createdAt, amount: p.amount })),
    bounds.from, bounds.to,
  )

  const byProvider: Record<string, number> = {}
  for (const p of payments) {
    byProvider[p.provider] = (byProvider[p.provider] || 0) + p.amount
  }
  const PROVIDER_LABELS: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
  const PROVIDER_COLORS: Record<string, string> = { cash: "#059669", click: "#2563eb", payme: "#7c3aed", uzum: "#d97706" }
  const providerData = Object.entries(byProvider).map(([key, val]) => ({
    name: PROVIDER_LABELS[key] ?? key, value: val, color: PROVIDER_COLORS[key] ?? "#6b7280",
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Выручка"     value={`${fmt(revenue)} сум`}   delta={revDelta} icon={TrendingUp} accent="#2563eb" />
        <KpiCard label="Прибыль ~70%" value={`${fmt(profit)} сум`}   icon={TrendingUp}  accent="#16a34a" />
        <KpiCard label="Расходы ~30%" value={`${fmt(expenses)} сум`} icon={TrendingDown} accent="#dc2626" />
        <KpiCard label="Средний чек" value={`${fmt(avgCheck)} сум`}  icon={CreditCard}  accent="#7c3aed" />
        <KpiCard label="Платежей"    value={String(payments.length)} sub={`~${Math.round(payments.length / days)}/день`} icon={BarChart2} accent="#059669" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Выручка по дням" action={<span className="text-xs" style={{ color: "var(--gray-muted)" }}>{fmt(revenue)} сум</span>}>
          <div style={{ height: 220, padding: "8px 8px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--gray-muted)" }} width={36} tickFormatter={fmtShort} />
                <Tooltip {...chartTooltipStyle} formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, "Выручка"]} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#rGrad)" dot={false} activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title="Способы оплаты">
            <div className="flex flex-col lg:flex-row items-center gap-4 p-4">
              {providerData.length > 0 ? (
                <>
                  <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={providerData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                          {providerData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${Number(v).toLocaleString("ru-RU")} сум`, ""]} contentStyle={chartTooltipStyle.contentStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 w-full">
                    {providerData.map((p) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-sm flex-1" style={{ color: "var(--on-dark-soft)" }}>{p.name}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{fmt(p.value)} сум</span>
                        <span className="text-xs w-10 text-right" style={{ color: "var(--gray-muted)" }}>
                          {revenue ? Math.round((p.value / revenue) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm py-8 text-center w-full" style={{ color: "var(--gray-muted)" }}>Нет данных</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

// ── 3. Sales Section ─────────────────────────────────────────────────

function SalesSection({ payments }: { payments: ReportPayment[] }) {
  const byService: Record<string, { count: number; revenue: number }> = {}
  for (const p of payments) {
    const key = p.serviceName ?? "Без абонемента"
    if (!byService[key]) byService[key] = { count: 0, revenue: 0 }
    byService[key].count++
    byService[key].revenue += p.amount
  }
  const totalRev = payments.reduce((a, p) => a + p.amount, 0)
  const rows = Object.entries(byService)
    .map(([name, { count, revenue }]) => ({ name, count, revenue, share: totalRev ? Math.round((revenue / totalRev) * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)

  const CHART_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Продано"        value={String(payments.length)} icon={CreditCard} accent="#2563eb" />
        <KpiCard label="Выручка"        value={`${fmt(totalRev)} сум`}  icon={TrendingUp}  accent="#16a34a" />
        <KpiCard label="Тарифов"        value={String(rows.length)}    icon={BarChart2}   accent="#7c3aed" />
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

function AttendanceSection({ visits, prevVisits, bounds }: {
  visits: Array<{ clientId: string; checkedInAt: string }>
  prevVisits: Array<{ clientId: string; checkedInAt: string }>
  bounds: ReturnType<typeof periodBounds>
}) {
  const days = daysBetween(bounds.from, bounds.to)
  const total = visits.length
  const prevTotal = prevVisits.length
  const avgPerDay = total / days

  const heatmap = useMemo(() => buildHeatmap(visits), [visits])
  const maxCell = Math.max(1, ...heatmap.flatMap(row => row))

  // Busiest hour
  const hourTotals = Array(24).fill(0)
  for (const v of visits) hourTotals[new Date(v.checkedInAt).getHours()]++
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals))

  // Quietest dow
  const dowTotals = Array(7).fill(0)
  for (const v of visits) dowTotals[(new Date(v.checkedInAt).getDay() + 6) % 7]++
  const quietDow = dowTotals.indexOf(Math.min(...dowTotals.filter(x => x > 0)))

  const visitsDelta = pct(total, prevTotal)

  const chartData = aggregateByDay(
    visits.map(v => ({ date: v.checkedInAt, amount: 1 })),
    bounds.from, bounds.to,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Всего посещений"  value={fmt(total)}                       delta={visitsDelta} icon={Activity} accent="#2563eb" />
        <KpiCard label="В среднем в день" value={avgPerDay.toFixed(1)}             icon={BarChart2}    accent="#7c3aed" />
        <KpiCard label="Пиковое время"    value={`${peakHour}:00–${peakHour+1}:00`} icon={TrendingUp} accent="#059669" />
        <KpiCard label="Тихий день"       value={DOW_LABELS[quietDow] ?? "—"}      icon={TrendingDown} accent="#d97706" />
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

function RenewalsSection({ clients }: { clients: ReportClient[] }) {
  const activeClients    = clients.filter(c => c.status === "active")
  const expiring30       = activeClients.filter(c => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 30)
  const expiring7        = activeClients.filter(c => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 7)
  const expired          = clients.filter(c => c.status === "expired")
  const convRate         = expiring30.length + expired.length
    ? Math.round((activeClients.length / (activeClients.length + expired.length)) * 100)
    : 100

  const expiryRows = expiring30
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    .slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Истекает до 30 дней" value={String(expiring30.length)} icon={RefreshCw} accent="#d97706" />
        <KpiCard label="Истекает до 7 дней"  value={String(expiring7.length)}  icon={AlertTriangle} accent="#dc2626" />
        <KpiCard label="Истёкших"            value={String(expired.length)}    icon={TrendingDown}  accent="#dc2626" />
        <KpiCard label="Активных"            value={`${convRate}%`}            sub="абонементов активно" icon={TrendingUp} accent="#16a34a" />
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

function GenderCard({ clients }: { clients: ReportClient[] }) {
  const total   = clients.length
  const male    = clients.filter(c => c.gender === "male").length
  const female  = clients.filter(c => c.gender === "female").length
  const unknown = total - male - female

  const malePct   = total ? Math.round((male   / total) * 100) : 0
  const femalePct = total ? Math.round((female / total) * 100) : 0

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
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
          <div className="rounded-xl p-4 flex flex-col items-center gap-1.5"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
            <span className="text-xl leading-none" style={{ color: "#3b82f6" }}>♂</span>
            <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: "#2563eb" }}>{male}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>
              {malePct}%
            </span>
            <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>мужчин</span>
          </div>

          <div className="rounded-xl p-4 flex flex-col items-center gap-1.5"
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

function ClientsSection({ clients, bounds }: { clients: ReportClient[]; bounds: ReturnType<typeof periodBounds> }) {
  const newInPeriod = clients.filter(c => c.createdAt >= bounds.from && c.createdAt <= bounds.to)
  const prevNew     = clients.filter(c => c.createdAt >= bounds.prevFrom && c.createdAt < bounds.prevTo)
  const newDelta    = pct(newInPeriod.length, prevNew.length)

  const expired     = clients.filter(c => c.status === "expired")
  const active      = clients.filter(c => c.status === "active")

  const sources: Record<string, number> = {}
  for (const c of newInPeriod) {
    const src = c.source ?? "other"
    sources[src] = (sources[src] || 0) + 1
  }
  const sourceRows = Object.entries(sources)
    .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] ?? key, count, color: SOURCE_COLORS[key] ?? "#6b7280" }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Новых клиентов"  value={String(newInPeriod.length)} delta={newDelta} icon={Users}         accent="#2563eb" />
        <KpiCard label="Всего клиентов"  value={String(clients.length)}     icon={Users}         accent="#7c3aed" />
        <KpiCard label="Активных"        value={String(active.length)}      icon={TrendingUp}    accent="#16a34a" />
        <KpiCard label="С истёкшим"      value={String(expired.length)}     icon={TrendingDown}  accent="#dc2626" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gender */}
        <GenderCard clients={clients} />

        {/* Sources */}
        <SectionCard title={`Источники (${newInPeriod.length} новых)`}>
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
                      style={{ width: `${newInPeriod.length ? (s.count / newInPeriod.length) * 100 : 0}%`, background: s.color }} />
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
                data={aggregateByDay(
                  newInPeriod.map(c => ({ date: c.createdAt, amount: 1 })),
                  bounds.from, bounds.to,
                )}
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

function DebtsSection({ debts }: { debts: ReportPayment[] }) {
  const total = debts.reduce((a, p) => a + p.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Должников"   value={String(debts.length)} icon={AlertTriangle} accent="#dc2626" />
        <KpiCard label="Общий долг"  value={`${fmt(total)} сум`}  icon={Wallet}         accent="#dc2626" />
      </div>

      <SectionCard title="Список долгов"
        action={
          <button className="h-7 px-3 rounded-md text-xs font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            Напомнить в Telegram
          </button>
        }
      >
        {debts.length === 0 ? (
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
                {debts.slice(0, 20).map((p) => (
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

function AiSection({ data, payments, visits, bounds }: {
  data: ReportsData
  payments: ReportPayment[]
  visits: Array<{ clientId: string; checkedInAt: string }>
  bounds: ReturnType<typeof periodBounds>
}) {
  const insights = useMemo(() => {
    const result: Array<{ icon: string; title: string; detail: string; level: "info" | "warning" | "success" }> = []

    const revenue = payments.reduce((a, p) => a + p.amount, 0)

    // Most popular membership
    const byService: Record<string, number> = {}
    for (const p of payments) {
      const k = p.serviceName ?? "Без абонемента"
      byService[k] = (byService[k] || 0) + 1
    }
    const topService = Object.entries(byService).sort((a, b) => b[1] - a[1])[0]
    if (topService) result.push({ icon: "🏆", title: `Топ тариф: ${topService[0]}`, detail: `Продан ${topService[1]} раз — самый популярный в выбранном периоде`, level: "success" })

    // Peak hour
    const hourTotals = Array(24).fill(0)
    for (const v of visits) hourTotals[new Date(v.checkedInAt).getHours()]++
    const peakH = hourTotals.indexOf(Math.max(...hourTotals))
    if (visits.length > 0) result.push({ icon: "⏰", title: `Пиковое время: ${peakH}:00–${peakH + 1}:00`, detail: `${hourTotals[peakH]} посещений в этот час — планируйте персонал заранее`, level: "info" })

    // At-risk clients
    const lastVisit: Record<string, string> = {}
    for (const v of data.visits) {
      if (!lastVisit[v.clientId] || v.checkedInAt > lastVisit[v.clientId]) lastVisit[v.clientId] = v.checkedInAt
    }
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
    const atRisk = data.clients.filter(c => c.status === "active" && (!lastVisit[c.id] || lastVisit[c.id] < cutoff))
    if (atRisk.length > 0) result.push({ icon: "⚠️", title: `${atRisk.length} клиентов под угрозой оттока`, detail: `Активный абонемент, но не приходили 14+ дней. Свяжитесь с ними.`, level: "warning" })

    // Payment method
    const byProvider: Record<string, number> = {}
    for (const p of payments) byProvider[p.provider] = (byProvider[p.provider] || 0) + p.amount
    const topProvider = Object.entries(byProvider).sort((a, b) => b[1] - a[1])[0]
    if (topProvider) {
      const share = revenue ? Math.round((topProvider[1] / revenue) * 100) : 0
      const PROVIDER_LABELS: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
      result.push({ icon: "💳", title: `${PROVIDER_LABELS[topProvider[0]] ?? topProvider[0]}: ${share}% выручки`, detail: `Основной способ оплаты в выбранном периоде`, level: "info" })
    }

    // Expiring
    const exp3 = data.clients.filter(c => c.status === "active" && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 3)
    if (exp3.length > 0) result.push({ icon: "🔔", title: `${exp3.length} абонементов истекают через 3 дня`, detail: `Отправьте напоминание для продления`, level: "warning" })

    // Revenue insight
    if (revenue > 0) {
      const avgPerDay = revenue / daysBetween(bounds.from, bounds.to)
      result.push({ icon: "📈", title: `Средняя выручка в день: ${fmt(Math.round(avgPerDay))} сум`, detail: `На основе периода ${payments.length} платежей`, level: "success" })
    }

    return result
  }, [data, payments, visits, bounds])

  const levelColors = {
    info:    { bg: "rgba(37,99,235,0.07)",    border: "rgba(37,99,235,0.15)",  tag: "rgba(37,99,235,0.12)",  tagText: "#2563eb" },
    warning: { bg: "rgba(217,119,6,0.07)",    border: "rgba(217,119,6,0.2)",  tag: "rgba(217,119,6,0.12)",  tagText: "#d97706" },
    success: { bg: "rgba(22,163,74,0.07)",    border: "rgba(22,163,74,0.2)",  tag: "rgba(22,163,74,0.12)",  tagText: "#16a34a" },
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.15)" }}>
        <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: "#2563eb" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>AI Аналитика</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>Выводы на основе реальных данных за выбранный период</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const c = levelColors[ins.level]
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{ins.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{ins.title}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{ins.detail}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl p-5 text-center" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
        <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--gray-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--on-dark-soft)" }}>Прогноз и рекомендации</p>
        <p className="text-xs mt-1" style={{ color: "var(--gray-muted)" }}>Скоро — AI-прогноз выручки и автоматические рекомендации по развитию клуба</p>
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

export function ReportsClient({ data }: { data: ReportsData }) {
  const [period,  setPeriod]  = useState<Period>("30d")
  const [section, setSection] = useState<Section>("alerts")

  const bounds = useMemo(() => periodBounds(period), [period])

  const paidPayments = useMemo(() =>
    data.payments.filter(p => p.status === "paid" && p.paidAt && p.paidAt >= bounds.from && p.paidAt <= bounds.to),
    [data.payments, bounds])

  const prevPaidPayments = useMemo(() =>
    data.payments.filter(p => p.status === "paid" && p.paidAt && p.paidAt >= bounds.prevFrom && p.paidAt < bounds.prevTo),
    [data.payments, bounds])

  const periodVisits = useMemo(() =>
    data.visits.filter(v => v.checkedInAt >= bounds.from && v.checkedInAt <= bounds.to),
    [data.visits, bounds])

  const prevVisits = useMemo(() =>
    data.visits.filter(v => v.checkedInAt >= bounds.prevFrom && v.checkedInAt < bounds.prevTo),
    [data.visits, bounds])

  const debts = useMemo(() =>
    data.payments.filter(p => p.status === "pending"),
    [data.payments])

  const alertsCount = useMemo(() => {
    const exp3 = data.clients.filter(c => c.status === "active" && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 3).length
    const debtCount = debts.length
    return exp3 + (debtCount > 0 ? 1 : 0)
  }, [data.clients, debts])

  function navigate(s: Section) { setSection(s); window.scrollTo({ top: 0, behavior: "smooth" }) }

  function handlePdf() {
    printPdf(data, paidPayments, periodVisits, debts, period)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-semibold tracking-[-0.144px]" style={{ fontSize: 24, color: "var(--on-dark)" }}>Отчёты</h1>
          <p style={{ fontSize: 15, color: "var(--on-dark-soft)", marginTop: 2 }}>Аналитика и статистика клуба</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <button onClick={handlePdf}
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={handlePdf}
            className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Period picker */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg flex-shrink-0" style={{ background: "var(--card-2)" }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: period === p.key ? "var(--pill-active)" : "transparent",
                color: period === p.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                boxShadow: period === p.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0">
          {SECTIONS.map(s => {
            const Icon = s.icon
            const active = section === s.key
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  background: active ? "#2563eb" : "transparent",
                  color: active ? "white" : "var(--on-dark-soft)",
                }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {s.label}
                {s.key === "alerts" && alertsCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                    style={{ background: active ? "rgba(255,255,255,0.25)" : "#dc2626", color: "white" }}>
                    {alertsCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {section === "alerts"   && <AlertsSection data={data} bounds={bounds} onNavigate={navigate} />}
      {section === "finance"  && <FinanceSection payments={paidPayments} prevPayments={prevPaidPayments} bounds={bounds} />}
      {section === "sales"    && <SalesSection payments={paidPayments} />}
      {section === "visits"   && <AttendanceSection visits={periodVisits} prevVisits={prevVisits} bounds={bounds} />}
      {section === "renewals" && <RenewalsSection clients={data.clients} />}
      {section === "clients"  && <ClientsSection clients={data.clients} bounds={bounds} />}
      {section === "staff"    && <StaffSection staff={data.staff} />}
      {section === "debts"    && <DebtsSection debts={debts} />}
      {section === "ai"       && <AiSection data={data} payments={paidPayments} visits={periodVisits} bounds={bounds} />}

    </div>
  )
}
