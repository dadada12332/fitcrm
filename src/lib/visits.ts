import type { SupabaseClient } from "@supabase/supabase-js"

export type VisitRow = {
  id: string
  clientId: string
  clientName: string
  clientPhone: string | null
  checkedInAt: string
  membershipName: string | null
  subscriptionStatus: string | null
  daysLeft: number | null
  visitsLeft: number | null
}

export type VisitsKPI = {
  today: number
  inGym: number
  missedToday: number
  avgLoad: number
}

export type ClientSearchResult = {
  id: string
  name: string
  phone: string | null
  photoUrl: string | null
  membershipName: string | null
  subscriptionId: string | null
  subscriptionStatus: string | null
  daysLeft: number | null
  visitsLeft: number | null
  visitedToday: boolean
}

function daysUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function todayStart() {
  return new Date().toISOString().slice(0, 10) + "T00:00:00"
}
function todayEnd() {
  return new Date().toISOString().slice(0, 10) + "T23:59:59"
}

export async function getVisitsKPI(supabase: SupabaseClient): Promise<VisitsKPI> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  const [{ count: todayCount }, { count: inGymCount }, { data: todayClients }, { count: activeCount }] =
    await Promise.all([
      supabase.from("visits").select("*", { count: "exact", head: true })
        .gte("checked_in_at", todayStart()).lte("checked_in_at", todayEnd()),
      supabase.from("visits").select("*", { count: "exact", head: true })
        .gte("checked_in_at", twoHoursAgo),
      supabase.from("visits").select("client_id")
        .gte("checked_in_at", todayStart()).lte("checked_in_at", todayEnd()),
      supabase.from("subscriptions").select("*", { count: "exact", head: true })
        .eq("status", "active"),
    ])

  const visitedTodayIds = new Set((todayClients ?? []).map((v: { client_id: string }) => v.client_id))
  const active_n = activeCount ?? 0
  const today_n = todayCount ?? 0
  const missed = Math.max(0, active_n - visitedTodayIds.size)

  return {
    today: today_n,
    inGym: inGymCount ?? 0,
    missedToday: missed,
    avgLoad: active_n > 0 ? Math.min(100, Math.round((visitedTodayIds.size / active_n) * 100)) : 0,
  }
}

export async function getTodayVisits(supabase: SupabaseClient): Promise<VisitRow[]> {
  const { data } = await supabase
    .from("visits")
    .select(`
      id, client_id, checked_in_at,
      clients(full_name, phone),
      subscriptions(status, expires_at, visits_total, visits_used, memberships(name))
    `)
    .gte("checked_in_at", todayStart())
    .lte("checked_in_at", todayEnd())
    .order("checked_in_at", { ascending: false })
    .limit(100)

  return (data ?? []).map((v: any) => {
    const sub = v.subscriptions
    const visitsTotal: number | null = sub?.visits_total ?? null
    const visitsUsed: number = sub?.visits_used ?? 0
    return {
      id: v.id,
      clientId: v.client_id,
      clientName: v.clients?.full_name ?? "—",
      clientPhone: v.clients?.phone ?? null,
      checkedInAt: v.checked_in_at,
      membershipName: sub?.memberships?.name ?? null,
      subscriptionStatus: sub?.status ?? null,
      daysLeft: daysUntil(sub?.expires_at ?? null),
      visitsLeft: visitsTotal !== null ? visitsTotal - visitsUsed : null,
    }
  })
}

export async function searchClientsForCheckin(
  supabase: SupabaseClient,
  query: string
): Promise<ClientSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const { data } = await supabase
    .from("clients")
    .select(`
      id, full_name, phone, photo_url,
      subscriptions(id, status, expires_at, visits_total, visits_used, memberships(name))
    `)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8)

  if (!data?.length) return []

  const clientIds = data.map((c: any) => c.id)
  const { data: todayVisits } = await supabase
    .from("visits")
    .select("client_id")
    .in("client_id", clientIds)
    .gte("checked_in_at", todayStart())

  const visitedTodaySet = new Set((todayVisits ?? []).map((v: any) => v.client_id))

  return data.map((c: any) => {
    const subs: any[] = c.subscriptions ?? []
    const sub = subs.find((s: any) => s.status === "active") ?? subs[0] ?? null
    const visitsTotal: number | null = sub?.visits_total ?? null
    const visitsUsed: number = sub?.visits_used ?? 0
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone ?? null,
      photoUrl: c.photo_url ?? null,
      membershipName: sub?.memberships?.name ?? null,
      subscriptionId: sub?.id ?? null,
      subscriptionStatus: sub?.status ?? null,
      daysLeft: daysUntil(sub?.expires_at ?? null),
      visitsLeft: visitsTotal !== null ? visitsTotal - visitsUsed : null,
      visitedToday: visitedTodaySet.has(c.id),
    }
  })
}
