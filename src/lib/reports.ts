import type { SupabaseClient } from "@supabase/supabase-js"

export type ReportPayment = {
  id: string
  amount: number
  status: string
  provider: string
  paidAt: string | null
  createdAt: string
  clientId: string | null
  clientName: string | null
  clientPhone: string | null
  serviceName: string | null
}

export type ReportVisit = {
  id: string
  clientId: string
  checkedInAt: string
}

export type ReportClient = {
  id: string
  name: string
  phone: string | null
  source: string | null
  gender: string | null
  createdAt: string
  status: string
  expiresAt: string | null
  daysLeft: number | null
  membershipName: string | null
}

export type ReportStaffRow = {
  id: string
  name: string
  role: string
  salary: number
  clientCount: number
  status: string
}

export type ReportsData = {
  payments: ReportPayment[]
  visits: ReportVisit[]
  clients: ReportClient[]
  staff: ReportStaffRow[]
}

function pickSub(subs: any[]) {
  if (!subs?.length) return null
  const active = subs.find((s: any) => s.status === "active")
  if (active) return active
  const frozen = subs.find((s: any) => s.status === "frozen")
  if (frozen) return frozen
  return [...subs].sort((a, b) => (b.expires_at ?? "").localeCompare(a.expires_at ?? ""))[0]
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

export async function getReportsData(supabase: SupabaseClient): Promise<ReportsData> {
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const yStr = yearAgo.toISOString()

  const [paymentsRes, visitsRes, clientsRes, staffRes, staffVisitsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, status, provider, paid_at, created_at, client_id, clients(full_name, phone), subscriptions(memberships(name))")
      .gte("created_at", yStr)
      .order("created_at", { ascending: false })
      .limit(5000),

    supabase
      .from("visits")
      .select("id, client_id, checked_in_at")
      .gte("checked_in_at", yStr)
      .order("checked_in_at", { ascending: false })
      .limit(20000),

    supabase
      .from("clients")
      .select("id, full_name, phone, gender, source, created_at, subscriptions(status, expires_at, memberships(name))")
      .order("created_at", { ascending: false }),

    supabase
      .from("staff")
      .select("id, user_id, role, salary, is_active, settings"),

    supabase
      .from("visits")
      .select("staff_id, client_id")
      .not("staff_id", "is", null),
  ])

  const payments: ReportPayment[] = (paymentsRes.data ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    provider: p.provider ?? "cash",
    paidAt: p.paid_at ?? null,
    createdAt: p.created_at,
    clientId: p.client_id ?? null,
    clientName: p.clients?.full_name ?? null,
    clientPhone: p.clients?.phone ?? null,
    serviceName: p.subscriptions?.memberships?.name ?? null,
  }))

  const visits: ReportVisit[] = (visitsRes.data ?? []).map((v: any) => ({
    id: v.id,
    clientId: v.client_id,
    checkedInAt: v.checked_in_at,
  }))

  const clients: ReportClient[] = (clientsRes.data ?? []).map((c: any) => {
    const sub = pickSub(c.subscriptions ?? [])
    const status = sub?.status ?? "none"
    const expiresAt = sub?.expires_at ?? null
    const mem = sub?.memberships
    const memName = mem ? (Array.isArray(mem) ? mem[0]?.name : mem.name) ?? null : null
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone ?? null,
      gender: c.gender ?? null,
      source: c.source ?? null,
      createdAt: c.created_at,
      status,
      expiresAt,
      daysLeft: (status === "active" || status === "frozen") ? daysUntil(expiresAt) : null,
      membershipName: memName,
    }
  })

  const staffRows: any[] = staffRes.data ?? []
  const allStaffVisits: any[] = staffVisitsRes.data ?? []
  const userIds = [...new Set(staffRows.map((s: any) => s.user_id as string))]
  const usersMap = new Map<string, { email: string; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, email, full_name")
      .in("id", userIds)
    for (const u of usersData ?? []) usersMap.set(u.id, u)
  }

  const staff: ReportStaffRow[] = staffRows.map((s: any) => {
    const u = usersMap.get(s.user_id)
    const settings = (s.settings ?? {}) as any
    const myVisits = allStaffVisits.filter((v: any) => v.staff_id === s.id)
    const clientCount = new Set(myVisits.map((v: any) => v.client_id)).size
    return {
      id: s.id,
      name: u?.full_name ?? u?.email ?? "—",
      role: s.role,
      salary: Number(s.salary) || Number(settings.salary_fixed) || 0,
      clientCount,
      status: settings.status ?? (s.is_active ? "active" : "fired"),
    }
  })

  return { payments, visits, clients, staff }
}
