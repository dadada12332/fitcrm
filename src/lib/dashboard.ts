import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/service"

export type NewClient = {
  id: string
  full_name: string
  tags: string[]
  created_at: string
  membership: string | null
  source: string | null
}

export type PeriodKey = "Сегодня" | "7Д" | "30Д" | "3М" | "Год"

export type PeriodStat = {
  revenue: number
  prevRevenue: number
  chart: { label: string; value: number; prev: number }[]
  unit: string
}

export type DashboardData = {
  todayRevenue: number
  prevRevenue: number
  activeClients: number
  prevClients: number
  todayVisits: number
  prevVisits: number
  expiringCount: number
  churnCount: number
  debtCount: number
  debtTotal: number
  todayNewClients: number
  todayPaymentsCount: number
  birthdaysToday: number
  alertsCount: number
  attendanceChangePct: number
  chartData: { label: string; value: number }[]
  periods: Record<PeriodKey, PeriodStat>
  newClients: NewClient[]
}

function withoutDashboardFinance(result: DashboardData): DashboardData {
  const hiddenPeriods = Object.fromEntries(
    Object.entries(result.periods).map(([key, value]) => [
      key,
      { ...value, revenue: 0, prevRevenue: 0, chart: value.chart.map((point) => ({ ...point, value: 0, prev: 0 })) },
    ]),
  ) as Record<PeriodKey, PeriodStat>
  return {
    ...result,
    todayRevenue: 0,
    prevRevenue: 0,
    debtCount: 0,
    debtTotal: 0,
    todayPaymentsCount: 0,
    chartData: result.chartData.map((point) => ({ ...point, value: 0 })),
    periods: hiddenPeriods,
  }
}

async function getDashboardFallback(supabase: SupabaseClient, clubId: string): Promise<DashboardData> {
  const now = Date.now()
  const DAY  = 86_400_000
  const HOUR = 3_600_000
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [clientsRes, visitsRes, paymentsRes, newClientsRes, debtRes, todayClientsRes, todayPaymentsRes] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).eq("status", "active"),
    supabase.from("visits").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("checked_in_at", todayISO),
    supabase.from("payments").select("amount, paid_at")
      .eq("club_id", clubId).eq("status", "paid")
      .gte("paid_at", new Date(now - 366 * DAY).toISOString()),
    supabase.from("clients").select("id, full_name, tags, created_at, source")
      .eq("club_id", clubId).order("created_at", { ascending: false }).limit(8),
    supabase.from("clients").select("debt").eq("club_id", clubId).gt("debt", 0),
    supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).gte("created_at", todayISO),
    supabase.from("payments").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).eq("status", "paid").gte("paid_at", todayISO),
  ])

  const payRows = ((paymentsRes.data ?? []) as { amount: number; paid_at: string }[])
    .map((r) => ({ t: new Date(r.paid_at).getTime(), a: Number(r.amount ?? 0) }))

  const sumBetween = (from: number, to: number) =>
    payRows.reduce((s, r) => (r.t >= from && r.t < to ? s + r.a : s), 0)

  const yest = new Date(today); yest.setDate(yest.getDate() - 1)
  const todayRevenue = sumBetween(today.getTime(), now)
  const prevRevenue  = sumBetween(yest.getTime(), today.getTime())

  const hourlyChart = (hours: number) => {
    const base = Math.floor(now / HOUR) * HOUR
    return Array.from({ length: hours }, (_, i) => {
      const start = base - (hours - 1 - i) * HOUR
      return { label: new Date(start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), value: sumBetween(start, start + HOUR), prev: sumBetween(start - hours * HOUR, start - hours * HOUR + HOUR) }
    })
  }

  const dailyChart = (daysN: number) =>
    Array.from({ length: daysN }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (daysN - 1 - i)); d.setHours(0, 0, 0, 0)
      const value = sumBetween(d.getTime(), d.getTime() + DAY)
      const prev  = sumBetween(d.getTime() - daysN * DAY, d.getTime() - daysN * DAY + DAY)
      return { label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }), value, prev }
    })

  const weeklyChart = (weeks: number) =>
    Array.from({ length: weeks }, (_, i) => {
      const start = now - (weeks - 1 - i) * 7 * DAY
      const value = sumBetween(start, start + 7 * DAY)
      const prev  = sumBetween(start - weeks * 7 * DAY, start - weeks * 7 * DAY + 7 * DAY)
      return { label: new Date(start).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }), value, prev }
    })

  const monthlyChart = (months: number) =>
    Array.from({ length: months }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (months - 1 - i)); d.setHours(0, 0, 0, 0)
      const start = d.getTime()
      d.setMonth(d.getMonth() + 1)
      const end = d.getTime()
      d.setMonth(d.getMonth() - 1 - months)
      const prevStart = d.getTime()
      d.setMonth(d.getMonth() + 1)
      const prev = sumBetween(prevStart, d.getTime())
      return { label: new Date(start).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }), value: sumBetween(start, end), prev }
    })

  const debtRows = debtRes.error ? [] : ((debtRes.data ?? []) as { debt: number }[])
  const debtCount = debtRows.length
  const debtTotal = debtRows.reduce((s, r) => s + Number(r.debt ?? 0), 0)

  const periods: Record<PeriodKey, PeriodStat> = {
    "Сегодня": { revenue: todayRevenue, prevRevenue, chart: hourlyChart(24), unit: "день" },
    "7Д":      { revenue: sumBetween(now - 7*DAY, now), prevRevenue: sumBetween(now-14*DAY, now-7*DAY), chart: dailyChart(7), unit: "неделю" },
    "30Д":     { revenue: sumBetween(now - 30*DAY, now), prevRevenue: sumBetween(now-60*DAY, now-30*DAY), chart: dailyChart(30), unit: "месяц" },
    "3М":      { revenue: sumBetween(now - 91*DAY, now), prevRevenue: sumBetween(now-182*DAY, now-91*DAY), chart: weeklyChart(13), unit: "3 мес" },
    "Год":     { revenue: sumBetween(now - 365*DAY, now), prevRevenue: 0, chart: monthlyChart(12), unit: "год" },
  }

  const newClients: NewClient[] = (newClientsRes.data ?? []).map((c) => ({
    id: c.id, full_name: c.full_name, tags: c.tags ?? [], created_at: c.created_at, membership: null, source: c.source ?? null,
  }))

  return {
    todayRevenue, prevRevenue,
    activeClients: clientsRes.count ?? 0, prevClients: 0,
    todayVisits: visitsRes.count ?? 0, prevVisits: 0,
    expiringCount: 0, churnCount: 0,
    debtCount, debtTotal,
    todayNewClients: todayClientsRes.error ? 0 : (todayClientsRes.count ?? 0),
    todayPaymentsCount: todayPaymentsRes.error ? 0 : (todayPaymentsRes.count ?? 0),
    birthdaysToday: 0,
    alertsCount: 0, attendanceChangePct: 0,
    chartData: periods["30Д"].chart,
    periods, newClients,
  }
}

export async function getDashboardData(_supabase: SupabaseClient, clubId: string, includeFinance = false): Promise<DashboardData> {
  const supabase = createServiceClient()
  const now   = Date.now()
  const DAY   = 86_400_000
  const HOUR  = 3_600_000
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const statsRes = await supabase.rpc("get_dashboard_stats", { p_club_id: clubId })

  const { data, error } = statsRes

  if (error) {
    const fallback = await getDashboardFallback(supabase, clubId)
    return includeFinance ? fallback : withoutDashboardFinance(fallback)
  }

  const d = data as Record<string, unknown>

  const visits7     = Number(d.visits7     ?? 0)
  const visitsPrev7 = Number(d.visitsPrev7 ?? 0)
  const attendanceChangePct = visitsPrev7 ? ((visits7 - visitsPrev7) / visitsPrev7) * 100 : 0

  const payRows = ((d.payments366 as { t: number; a: number }[]) ?? [])
    .map((r) => ({ t: r.t, a: Number(r.a ?? 0) }))

  const yest = new Date(today); yest.setDate(yest.getDate() - 1)

  const sumBetween = (from: number, to: number) =>
    payRows.reduce((s, r) => (r.t >= from && r.t < to ? s + r.a : s), 0)

  const hourlyChart = (hours: number) => {
    const base = Math.floor(now / HOUR) * HOUR
    return Array.from({ length: hours }, (_, i) => {
      const start = base - (hours - 1 - i) * HOUR
      return { label: new Date(start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), value: sumBetween(start, start + HOUR), prev: sumBetween(start - hours * HOUR, start - hours * HOUR + HOUR) }
    })
  }

  const dailyChart = (daysN: number) =>
    Array.from({ length: daysN }, (_, i) => {
      const d2 = new Date(); d2.setDate(d2.getDate() - (daysN - 1 - i)); d2.setHours(0, 0, 0, 0)
      const value = sumBetween(d2.getTime(), d2.getTime() + DAY)
      const prev  = sumBetween(d2.getTime() - daysN * DAY, d2.getTime() - daysN * DAY + DAY)
      return { label: d2.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }), value, prev }
    })

  const weeklyChart = (weeks: number) =>
    Array.from({ length: weeks }, (_, i) => {
      const start = now - (weeks - 1 - i) * 7 * DAY
      const value = sumBetween(start, start + 7 * DAY)
      const prev  = sumBetween(start - weeks * 7 * DAY, start - weeks * 7 * DAY + 7 * DAY)
      return { label: new Date(start).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }), value, prev }
    })

  const monthlyChart = (months: number) =>
    Array.from({ length: months }, (_, i) => {
      const dm = new Date(); dm.setDate(1); dm.setMonth(dm.getMonth() - (months - 1 - i)); dm.setHours(0, 0, 0, 0)
      const start = dm.getTime()
      dm.setMonth(dm.getMonth() + 1)
      const end = dm.getTime()
      dm.setMonth(dm.getMonth() - 1 - months)
      const prevStart = dm.getTime()
      dm.setMonth(dm.getMonth() + 1)
      const prev = sumBetween(prevStart, dm.getTime())
      return { label: new Date(start).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }), value: sumBetween(start, end), prev }
    })

  const periods: Record<PeriodKey, PeriodStat> = {
    "Сегодня": { revenue: sumBetween(today.getTime(), now), prevRevenue: sumBetween(yest.getTime(), today.getTime()), chart: hourlyChart(24), unit: "день" },
    "7Д":      { revenue: sumBetween(now-7*DAY, now), prevRevenue: sumBetween(now-14*DAY, now-7*DAY), chart: dailyChart(7), unit: "неделю" },
    "30Д":     { revenue: sumBetween(now-30*DAY, now), prevRevenue: sumBetween(now-60*DAY, now-30*DAY), chart: dailyChart(30), unit: "месяц" },
    "3М":      { revenue: sumBetween(now-91*DAY, now), prevRevenue: sumBetween(now-182*DAY, now-91*DAY), chart: weeklyChart(13), unit: "3 мес" },
    "Год":     { revenue: sumBetween(now-365*DAY, now), prevRevenue: 0, chart: monthlyChart(12), unit: "год" },
  }

  const newClients = ((d.newClients as NewClient[]) ?? []).map((c) => ({
    ...c, source: c.source ?? null,
  }))

  const result: DashboardData = {
    todayRevenue:      periods["Сегодня"].revenue,
    prevRevenue:       periods["Сегодня"].prevRevenue,
    activeClients:     Number(d.activeClients  ?? 0),
    prevClients:       Number(d.prevClients    ?? 0),
    todayVisits:       Number(d.todayVisits    ?? 0),
    prevVisits:        Number(d.yesterdayVisits ?? 0),
    expiringCount:     Number(d.expiringCount  ?? 0),
    churnCount:        Number(d.churnCount     ?? 0),
    debtCount:          Number(d.debtCount ?? 0),
    debtTotal:          Number(d.debtTotal ?? 0),
    todayNewClients:    Number(d.todayNewClients ?? 0),
    todayPaymentsCount: Number(d.todayPaymentsCount ?? 0),
    birthdaysToday:     Number(d.birthdaysToday ?? 0),
    alertsCount:       Number(d.expiringCount ?? 0) + Number(d.churnCount ?? 0),
    attendanceChangePct,
    chartData: periods["30Д"].chart,
    periods, newClients,
  }
  if (includeFinance) return result
  return withoutDashboardFinance(result)
}
