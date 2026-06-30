import type { SupabaseClient } from "@supabase/supabase-js"

export type NewClient = {
  id: string
  full_name: string
  tags: string[]
  created_at: string
  membership: string | null
}

export type PeriodKey = "1Ч" | "1Д" | "7Д" | "1М"

export type PeriodStat = {
  revenue: number
  prevRevenue: number
  chart: { label: string; value: number }[]
  unit: string // подпись «за час/день/неделю/месяц»
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
  alertsCount: number
  attendanceChangePct: number
  chartData: { label: string; value: number }[]
  periods: Record<PeriodKey, PeriodStat>
  newClients: NewClient[]
}

/** Single source of dashboard metrics — reused by the page and the Excel export route. */
export async function getDashboardData(supabase: SupabaseClient, clubId: string): Promise<DashboardData> {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const prev60 = new Date(now); prev60.setDate(now.getDate() - 60)
  const next7 = new Date(now); next7.setDate(now.getDate() + 7)
  const prev7 = new Date(now); prev7.setDate(now.getDate() - 7)
  const prev14 = new Date(now); prev14.setDate(now.getDate() - 14)

  const [
    pay60Res,
    activeClientsRes,
    prevMonthClientsRes,
    todayVisitsRes,
    yesterdayVisitsRes,
    expiringRes,
    churnRes,
    visits7Res,
    visitsPrev7Res,
    newClientsRes,
  ] = await Promise.all([
    supabase.from("payments").select("paid_at, amount").eq("club_id", clubId).eq("status", "paid").gte("paid_at", prev60.toISOString()),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId).lt("created_at", monthStart.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId)
      .gte("checked_in_at", yesterdayStart.toISOString()).lt("checked_in_at", todayStart.toISOString()),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId)
      .eq("status", "active").gte("expires_at", now.toISOString()).lte("expires_at", next7.toISOString()),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId)
      .eq("status", "expired").gte("expires_at", prev7.toISOString()).lte("expires_at", now.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", prev7.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId)
      .gte("checked_in_at", prev14.toISOString()).lt("checked_in_at", prev7.toISOString()),
    supabase.from("clients").select("id, full_name, tags, created_at").eq("club_id", clubId).order("created_at", { ascending: false }).limit(6),
  ])

  const expiringCount = expiringRes.count ?? 0
  const churnCount = churnRes.count ?? 0

  const visits7 = visits7Res.count ?? 0
  const visitsPrev7 = visitsPrev7Res.count ?? 0
  const attendanceChangePct = visitsPrev7 ? ((visits7 - visitsPrev7) / visitsPrev7) * 100 : 0

  // ── Revenue by period (computed from one 60-day fetch) ──
  const payRows = (pay60Res.data ?? [])
    .filter((r) => r.paid_at)
    .map((r) => ({ t: new Date(r.paid_at as string).getTime(), a: Number(r.amount ?? 0) }))
  const nowMs = now.getTime()
  const HOUR = 3600_000
  const DAY = 86_400_000
  const sumBetween = (from: number, to: number) =>
    payRows.reduce((s, r) => (r.t >= from && r.t < to ? s + r.a : s), 0)

  const hourlyChart = (hours: number) => {
    const arr: { label: string; value: number }[] = []
    const base = Math.floor(nowMs / HOUR) * HOUR
    for (let i = hours - 1; i >= 0; i--) {
      const start = base - i * HOUR
      arr.push({
        label: new Date(start).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        value: sumBetween(start, start + HOUR),
      })
    }
    return arr
  }
  const dailyChart = (daysN: number) => {
    const arr: { label: string; value: number }[] = []
    for (let i = daysN - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0)
      const start = d.getTime()
      arr.push({
        label: new Date(start).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" }),
        value: sumBetween(start, start + DAY),
      })
    }
    return arr
  }

  const periods: Record<PeriodKey, PeriodStat> = {
    "1Ч": {
      revenue: sumBetween(nowMs - HOUR, nowMs),
      prevRevenue: sumBetween(nowMs - 2 * HOUR, nowMs - HOUR),
      chart: hourlyChart(12),
      unit: "час",
    },
    "1Д": {
      revenue: sumBetween(todayStart.getTime(), nowMs),
      prevRevenue: sumBetween(yesterdayStart.getTime(), todayStart.getTime()),
      chart: hourlyChart(24),
      unit: "день",
    },
    "7Д": {
      revenue: sumBetween(nowMs - 7 * DAY, nowMs),
      prevRevenue: sumBetween(nowMs - 14 * DAY, nowMs - 7 * DAY),
      chart: dailyChart(7),
      unit: "неделю",
    },
    "1М": {
      revenue: sumBetween(nowMs - 30 * DAY, nowMs),
      prevRevenue: sumBetween(nowMs - 60 * DAY, nowMs - 30 * DAY),
      chart: dailyChart(30),
      unit: "месяц",
    },
  }

  // Backwards-compatible fields (used by the Excel export route)
  const todayRevenue = periods["1Д"].revenue
  const prevRevenue = periods["1Д"].prevRevenue
  const chartData = periods["1М"].chart

  // Attach each new client's subscription (membership) name
  const rawNew = (newClientsRes.data ?? []) as Omit<NewClient, "membership">[]
  const ids = rawNew.map((c) => c.id)
  const membershipByClient: Record<string, string> = {}
  if (ids.length) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("client_id, status, created_at, memberships(name)")
      .eq("club_id", clubId)
      .in("client_id", ids)
      .order("created_at", { ascending: false })
    for (const s of subs ?? []) {
      const cid = s.client_id as string
      const m = s.memberships as unknown as { name: string } | null
      // keep the latest (first seen); prefer active if encountered
      if (!membershipByClient[cid] || s.status === "active") {
        if (m?.name) membershipByClient[cid] = m.name
      }
    }
  }
  const newClients: NewClient[] = rawNew.map((c) => ({
    ...c,
    membership: membershipByClient[c.id] ?? null,
  }))

  return {
    todayRevenue,
    prevRevenue,
    activeClients: activeClientsRes.count ?? 0,
    prevClients: prevMonthClientsRes.count ?? 0,
    todayVisits: todayVisitsRes.count ?? 0,
    prevVisits: yesterdayVisitsRes.count ?? 0,
    expiringCount,
    churnCount,
    alertsCount: expiringCount + churnCount,
    attendanceChangePct,
    chartData,
    periods,
    newClients,
  }
}
