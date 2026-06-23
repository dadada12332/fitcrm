import type { SupabaseClient } from "@supabase/supabase-js"

export type MembershipStatus = "active" | "inactive" | "archived"

export type MembershipRow = {
  id: string
  name: string
  price: number
  durationDays: number
  visitsLimit: number | null
  isActive: boolean
  archived: boolean
  activeClients: number
  // доп. поля для формы редактирования
  description: string | null
  pricePerDay: number | null
  freezeAllowed: boolean
  availableDays: string[]
  availableTime: string[]
  validUntil: string | null // ISO YYYY-MM-DD
}

export function membershipStatus(r: { isActive: boolean; archived: boolean }): MembershipStatus {
  if (r.archived) return "archived"
  return r.isActive ? "active" : "inactive"
}

export const statusMeta: Record<MembershipStatus, { label: string; bg: string; color: string }> = {
  active: { label: "Активный", bg: "#dcfce7", color: "#16a34a" },
  inactive: { label: "Отключён", bg: "#fef3c7", color: "#d97706" },
  archived: { label: "Архив", bg: "#f1f5f9", color: "#64748b" },
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
      .select("id, name, price, duration_days, visits_limit, is_active, archived, freeze_days_allowed, description, price_per_day, available_days, available_time, valid_until, created_at")
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
    archived: boolean | null
    freeze_days_allowed: number | null
    description: string | null
    price_per_day: number | null
    available_days: string[] | null
    available_time: string[] | null
    valid_until: string | null
  }[]

  const rows: MembershipRow[] = memberships.map((m) => ({
    id: m.id,
    name: m.name,
    price: Number(m.price ?? 0),
    durationDays: m.duration_days,
    visitsLimit: m.visits_limit,
    isActive: m.is_active,
    archived: m.archived ?? false,
    activeClients: activeByMembership[m.id] ?? 0,
    description: m.description ?? null,
    pricePerDay: m.price_per_day !== null && m.price_per_day !== undefined ? Number(m.price_per_day) : null,
    freezeAllowed: (m.freeze_days_allowed ?? 0) > 0,
    availableDays: m.available_days ?? [],
    availableTime: m.available_time ?? [],
    validUntil: m.valid_until ?? null,
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
