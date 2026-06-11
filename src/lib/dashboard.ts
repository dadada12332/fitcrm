import type { SupabaseClient } from "@supabase/supabase-js"

export type NewClient = {
  id: string
  full_name: string
  tags: string[]
  created_at: string
  membership: string | null
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
  chartData: { value: number }[]
  newClients: NewClient[]
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

/** Single source of dashboard metrics — reused by the page and the Excel export route. */
export async function getDashboardData(supabase: SupabaseClient): Promise<DashboardData> {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const prev30 = new Date(now); prev30.setDate(now.getDate() - 30)
  const next7 = new Date(now); next7.setDate(now.getDate() + 7)
  const prev7 = new Date(now); prev7.setDate(now.getDate() - 7)
  const prev14 = new Date(now); prev14.setDate(now.getDate() - 14)

  const [
    todayPayRes,
    yesterdayPayRes,
    activeClientsRes,
    prevMonthClientsRes,
    todayVisitsRes,
    yesterdayVisitsRes,
    expiringRes,
    churnRes,
    chartPayRes,
    visits7Res,
    visitsPrev7Res,
    newClientsRes,
  ] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", todayStart.toISOString()),
    supabase.from("payments").select("amount").eq("status", "paid")
      .gte("paid_at", yesterdayStart.toISOString()).lt("paid_at", todayStart.toISOString()),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }).lt("created_at", monthStart.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true })
      .gte("checked_in_at", yesterdayStart.toISOString()).lt("checked_in_at", todayStart.toISOString()),
    supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("status", "active").gte("expires_at", now.toISOString()).lte("expires_at", next7.toISOString()),
    supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("status", "expired").gte("expires_at", prev7.toISOString()).lte("expires_at", now.toISOString()),
    supabase.from("payments").select("paid_at, amount").eq("status", "paid").gte("paid_at", prev30.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).gte("checked_in_at", prev7.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true })
      .gte("checked_in_at", prev14.toISOString()).lt("checked_in_at", prev7.toISOString()),
    supabase.from("clients").select("id, full_name, tags, created_at").order("created_at", { ascending: false }).limit(6),
  ])

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const todayRevenue = sum(todayPayRes.data)
  const prevRevenue = sum(yesterdayPayRes.data)
  const expiringCount = expiringRes.count ?? 0
  const churnCount = churnRes.count ?? 0

  const visits7 = visits7Res.count ?? 0
  const visitsPrev7 = visitsPrev7Res.count ?? 0
  const attendanceChangePct = visitsPrev7 ? ((visits7 - visitsPrev7) / visitsPrev7) * 100 : 0

  // Chart: revenue grouped by day for the last 30 days
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    dayMap[formatDay(d.toISOString())] = 0
  }
  for (const row of chartPayRes.data ?? []) {
    if (!row.paid_at) continue
    const key = formatDay(row.paid_at)
    if (key in dayMap) dayMap[key] = (dayMap[key] ?? 0) + Number(row.amount ?? 0)
  }
  const chartData = Object.values(dayMap).map((value) => ({ value }))

  // Attach each new client's subscription (membership) name
  const rawNew = (newClientsRes.data ?? []) as Omit<NewClient, "membership">[]
  const ids = rawNew.map((c) => c.id)
  const membershipByClient: Record<string, string> = {}
  if (ids.length) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("client_id, status, created_at, memberships(name)")
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
    newClients,
  }
}
