import { sanitizeSearchTerm } from "@/lib/search"
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

export async function getVisitsKPI(supabase: SupabaseClient, clubId: string): Promise<VisitsKPI> {
  const { data, error } = await supabase.rpc("get_visits_kpi", { p_club_id: clubId })

  if (!error && data) {
    const d = data as {
      today_count: number
      in_gym_count: number
      unique_today: number
      active_subs: number
    }
    const active_n    = Number(d.active_subs)
    const uniqueToday = Number(d.unique_today)
    return {
      today:        Number(d.today_count),
      inGym:        Number(d.in_gym_count),
      missedToday:  Math.max(0, active_n - uniqueToday),
      avgLoad:      active_n > 0 ? Math.min(100, Math.round((uniqueToday / active_n) * 100)) : 0,
    }
  }

  // Fallback: parallel queries (used before RPC migration is applied)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const [{ count: todayCount }, { count: inGymCount }, { data: todayClients }, { count: activeCount }] =
    await Promise.all([
      supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId)
        .gte("checked_in_at", todayStart()).lte("checked_in_at", todayEnd()),
      supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId)
        .gte("checked_in_at", twoHoursAgo),
      supabase.from("visits").select("client_id").eq("club_id", clubId)
        .gte("checked_in_at", todayStart()).lte("checked_in_at", todayEnd()),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId)
        .eq("status", "active"),
    ])

  const visitedTodayIds = new Set((todayClients ?? []).map((v: { client_id: string }) => v.client_id))
  const active_n = activeCount ?? 0
  const today_n  = todayCount ?? 0

  return {
    today:       today_n,
    inGym:       inGymCount ?? 0,
    missedToday: Math.max(0, active_n - visitedTodayIds.size),
    avgLoad:     active_n > 0 ? Math.min(100, Math.round((visitedTodayIds.size / active_n) * 100)) : 0,
  }
}

export async function getTodayVisits(supabase: SupabaseClient, clubId: string): Promise<VisitRow[]> {
  const { data } = await supabase
    .from("visits")
    .select(`
      id, client_id, checked_in_at,
      clients(full_name, phone),
      subscriptions(status, expires_at, visits_total, visits_used, memberships(name))
    `)
    .eq("club_id", clubId)
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

// ── Серверная пагинация журнала посещений ─────────────────────
export type VisitsQuery = {
  search?: string
  from?: string        // ISO (по умолчанию начало сегодня)
  to?: string          // ISO (по умолчанию конец сегодня)
  status?: string      // all|active|ending|expired
  sort?: string        // checked_asc|(default checked_desc)
  page?: number
  pageSize?: number
}
export type VisitsPageResult = { rows: VisitRow[]; total: number; page: number; pageSize: number }
export const VISITS_PAGE_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVisitRpc(v: any): VisitRow {
  return {
    id: v.id,
    clientId: v.client_id,
    clientName: v.client_name ?? "—",
    clientPhone: v.client_phone ?? null,
    checkedInAt: v.checked_in_at,
    membershipName: v.membership_name ?? null,
    subscriptionStatus: v.sub_status ?? null,
    daysLeft: v.days_left ?? null,
    visitsLeft: v.visits_left ?? null,
  }
}

function visitBucket(r: VisitRow): "active" | "ending" | "expired" {
  if (!r.subscriptionStatus || r.subscriptionStatus === "expired") return "expired"
  if ((r.daysLeft !== null && r.daysLeft <= 5) || (r.visitsLeft !== null && r.visitsLeft <= 3)) return "ending"
  return "active"
}

export async function getVisitsPage(
  supabase: SupabaseClient,
  clubId: string,
  q: VisitsQuery,
): Promise<VisitsPageResult> {
  const pageSize = q.pageSize ?? VISITS_PAGE_SIZE
  const page = Math.max(0, q.page ?? 0)
  const from = q.from ?? todayStart()
  const to = q.to ?? todayEnd()
  const args = {
    p_club_id: clubId,
    p_search: q.search?.trim() || null,
    p_from: from,
    p_to: to,
    p_status: q.status && q.status !== "all" ? q.status : null,
    p_sort: q.sort || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  }
  const res = await supabase.rpc("visits_page", args)
  if (res.error) {
    // Fallback: сегодняшний журнал + фильтрация в памяти.
    const all = await getTodayVisits(supabase, clubId)
    const search = q.search?.trim().toLowerCase() ?? ""
    let filtered = all.filter((r) => {
      if (q.status && q.status !== "all" && visitBucket(r) !== q.status) return false
      if (search && !r.clientName.toLowerCase().includes(search)) return false
      return true
    })
    if (q.sort === "checked_asc") filtered = [...filtered].sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))
    const total = filtered.length
    const start = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1)) * pageSize
    return { rows: filtered.slice(start, start + pageSize), total, page, pageSize }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data = (res.data ?? []) as any[]
  let total = data.length > 0 ? Number(data[0].total_count) : 0
  if (data.length === 0 && page > 0) {
    const retry = await supabase.rpc("visits_page", { ...args, p_offset: 0 })
    if (!retry.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data = (retry.data ?? []) as any[]
      total = data.length > 0 ? Number(data[0].total_count) : 0
    }
  }
  return {
    rows: data.map(mapVisitRpc),
    total,
    page: data.length === 0 && page > 0 ? 0 : page,
    pageSize,
  }
}

export async function searchClientsForCheckin(
  supabase: SupabaseClient,
  query: string,
  clubId: string
): Promise<ClientSearchResult[]> {
  const q = query.trim()
  if (q.length < 1) return []

  const todayTs = todayStart()

  const [{ data }, { data: todayVisits }] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id, full_name, phone, photo_url,
        subscriptions(id, status, expires_at, visits_total, visits_used, memberships(name))
      `)
      .eq("club_id", clubId)
      .or(`full_name.ilike.%${sanitizeSearchTerm(q)}%,phone.ilike.%${sanitizeSearchTerm(q)}%`)
      .limit(8),
    supabase
      .from("visits")
      .select("client_id")
      .eq("club_id", clubId)
      .gte("checked_in_at", todayTs),
  ])

  if (!data?.length) return []

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
