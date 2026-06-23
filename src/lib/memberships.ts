import type { SupabaseClient } from "@supabase/supabase-js"

export type MembershipRow = {
  id: string
  name: string
  price: number
  durationDays: number
  visitsLimit: number | null
  isActive: boolean
  activeClients: number
}

export type MembershipsStats = {
  total: number
  active: number
  activePct: number
  soldThisMonth: number
  revenueThisMonth: number
  revenuePrevMonth: number
}

export type MembershipsData = { rows: MembershipRow[]; stats: MembershipsStats }

/** Склонение «день/дня/дней» */
export function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} день`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня`
  return `${n} дней`
}

export async function getMembershipsData(supabase: SupabaseClient): Promise<MembershipsData> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [membershipsRes, activeSubsRes, soldRes, payCurRes, payPrevRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, name, price, duration_days, visits_limit, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("membership_id, status").eq("status", "active"),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", monthStart.toISOString()),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "paid")
      .gte("paid_at", prevMonthStart.toISOString())
      .lt("paid_at", monthStart.toISOString()),
  ])

  // активных подписок на каждый тариф
  const activeByMembership: Record<string, number> = {}
  for (const s of activeSubsRes.data ?? []) {
    const mid = s.membership_id as string | null
    if (mid) activeByMembership[mid] = (activeByMembership[mid] ?? 0) + 1
  }

  const memberships = (membershipsRes.data ?? []) as {
    id: string
    name: string
    price: number
    duration_days: number
    visits_limit: number | null
    is_active: boolean
  }[]

  const rows: MembershipRow[] = memberships.map((m) => ({
    id: m.id,
    name: m.name,
    price: Number(m.price ?? 0),
    durationDays: m.duration_days,
    visitsLimit: m.visits_limit,
    isActive: m.is_active,
    activeClients: activeByMembership[m.id] ?? 0,
  }))

  const total = rows.length
  const active = rows.filter((r) => r.isActive).length
  const revenueThisMonth = (payCurRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const revenuePrevMonth = (payPrevRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const stats: MembershipsStats = {
    total,
    active,
    activePct: total ? Math.round((active / total) * 100) : 0,
    soldThisMonth: soldRes.count ?? 0,
    revenueThisMonth,
    revenuePrevMonth,
  }

  return { rows, stats }
}
