import type { SupabaseClient } from "@supabase/supabase-js"
import { unstable_cache } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"

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

type ReportSubscriptionRecord = {
  status: string
  expires_at: string | null
  memberships: { name: string } | Array<{ name: string }> | null
}
type ReportPaymentRecord = {
  id: string
  amount: number | string
  status: string
  provider: string | null
  paid_at: string | null
  created_at: string
  client_id: string | null
  clients: { full_name: string; phone: string | null } | Array<{ full_name: string; phone: string | null }> | null
  subscriptions: { memberships: { name: string } | Array<{ name: string }> | null } | Array<{ memberships: { name: string } | Array<{ name: string }> | null }> | null
}
type ReportVisitRecord = { id: string; client_id: string; checked_in_at: string }
type ReportClientRecord = {
  id: string
  full_name: string
  phone: string | null
  gender: string | null
  source: string | null
  created_at: string
  subscriptions: ReportSubscriptionRecord[] | null
}
type ReportStaffRecord = {
  id: string
  role: string
  salary: number | string | null
  is_active: boolean
  settings: { salary_fixed?: number; status?: string } | null
  users: { email: string; full_name: string | null } | Array<{ email: string; full_name: string | null }> | null
}
type ReportStaffVisitRecord = { staff_id: string; client_id: string }
type PageResult = { data: unknown[] | null; error: unknown }

function pickSub(subs: ReportSubscriptionRecord[]) {
  if (!subs?.length) return null
  const active = subs.find((s) => s.status === "active")
  if (active) return active
  const frozen = subs.find((s) => s.status === "frozen")
  if (frozen) return frozen
  return [...subs].sort((a, b) => (b.expires_at ?? "").localeCompare(a.expires_at ?? ""))[0]
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

// PostgREST отдаёт максимум 1000 строк на запрос — тянем всё страницами по 1000,
// иначе отчёты считались по первым 1000 строкам (недоучёт на больших клубах).
async function fetchAllRows(build: (from: number, to: number) => PromiseLike<PageResult>): Promise<unknown[]> {
  const PAGE = 1000
  const acc: unknown[] = []
  for (let from = 0; from < 200 * PAGE; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) break
    if (data) acc.push(...data)
    if (!data || data.length < PAGE) break
  }
  return acc
}

export async function getReportsData(supabase: SupabaseClient, clubId: string): Promise<ReportsData> {
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const yStr = yearAgo.toISOString()

  const [paymentsRes, visitsRes, clientsRes, staffRes, staffVisitsRes] = await Promise.all([
    fetchAllRows((f, t) => supabase
      .from("payments")
      .select("id, amount, status, provider, paid_at, created_at, client_id, clients(full_name, phone), subscriptions(memberships(name))")
      .eq("club_id", clubId)
      .gte("created_at", yStr)
      .order("created_at", { ascending: false })
      .range(f, t)).then((data) => ({ data })),

    fetchAllRows((f, t) => supabase
      .from("visits")
      .select("id, client_id, checked_in_at")
      .eq("club_id", clubId)
      .gte("checked_in_at", yStr)
      .order("checked_in_at", { ascending: false })
      .range(f, t)).then((data) => ({ data })),

    fetchAllRows((f, t) => supabase
      .from("clients")
      .select("id, full_name, phone, gender, source, created_at, subscriptions(status, expires_at, memberships(name))")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .range(f, t)).then((data) => ({ data })),

    createServiceClient()
      .from("staff")
      .select("id, user_id, role, salary, is_active, settings, users(id, email, full_name)")
      .eq("club_id", clubId),

    fetchAllRows((f, t) => supabase
      .from("visits")
      .select("staff_id, client_id")
      .eq("club_id", clubId)
      .not("staff_id", "is", null)
      .range(f, t)).then((data) => ({ data })),
  ])

  const payments: ReportPayment[] = (paymentsRes.data as ReportPaymentRecord[]).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients
    const subscription = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions
    const membership = Array.isArray(subscription?.memberships) ? subscription.memberships[0] : subscription?.memberships
    return {
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      provider: p.provider ?? "cash",
      paidAt: p.paid_at ?? null,
      createdAt: p.created_at,
      clientId: p.client_id ?? null,
      clientName: client?.full_name ?? null,
      clientPhone: client?.phone ?? null,
      serviceName: membership?.name ?? null,
    }
  })

  const visits: ReportVisit[] = (visitsRes.data as ReportVisitRecord[]).map((v) => ({
    id: v.id,
    clientId: v.client_id,
    checkedInAt: v.checked_in_at,
  }))

  const clients: ReportClient[] = (clientsRes.data as ReportClientRecord[]).map((c) => {
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

  const staffRows = (staffRes.data ?? []) as unknown as ReportStaffRecord[]
  const allStaffVisits = staffVisitsRes.data as ReportStaffVisitRecord[]

  const staff: ReportStaffRow[] = staffRows.map((s) => {
    const u = Array.isArray(s.users) ? s.users[0] : s.users
    const settings = s.settings ?? {}
    const myVisits = allStaffVisits.filter((v) => v.staff_id === s.id)
    const clientCount = new Set(myVisits.map((v) => v.client_id)).size
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

/**
 * Кешированные данные отчётов (per-club, 120 c). Использует service-role клиент,
 * поэтому вызывать ТОЛЬКО после проверки прав (reports.view) в экшене.
 * Повторные открытия/переключения периодов в пределах 2 минут — из кеша.
 */
export async function getReportsDataCached(clubId: string): Promise<ReportsData> {
  const run = unstable_cache(
    async () => getReportsData(createServiceClient(), clubId),
    ["reports-data", clubId],
    { revalidate: 120, tags: [`reports-${clubId}`] },
  )
  return run()
}

// ── Серверная агрегация вкладок (поэтапная миграция) ──────────
export type FinanceAgg = {
  revenue: number
  count: number
  prevRevenue: number
  byProvider: { provider: string; amount: number }[]
  byDay: { day: string; amount: number }[]
}

/** Финансовая агрегация за период (RPC reports_finance, кеш per-club+период). */
export async function getReportsFinance(
  clubId: string, from: string, to: string, prevFrom: string, prevTo: string,
): Promise<FinanceAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_finance", {
        p_club_id: clubId, p_from: from, p_to: to, p_prev_from: prevFrom, p_prev_to: prevTo,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      return {
        revenue: Number(d.revenue ?? 0),
        count: Number(d.count ?? 0),
        prevRevenue: Number(d.prevRevenue ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byProvider: (d.byProvider ?? []).map((x: any) => ({ provider: x.provider, amount: Number(x.amount) })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byDay: (d.byDay ?? []).map((x: any) => ({ day: x.day, amount: Number(x.amount) })),
      } as FinanceAgg
    },
    ["reports-finance", clubId, from, to, prevFrom, prevTo],
    { revalidate: 120 },
  )
  return run()
}

export type SalesAgg = {
  sold: number
  totalRevenue: number
  byService: { name: string; count: number; revenue: number }[]
}

/** Агрегация продаж за период (RPC reports_sales, кеш per-club+период). */
export async function getReportsSales(
  clubId: string, from: string, to: string,
): Promise<SalesAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_sales", { p_club_id: clubId, p_from: from, p_to: to })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      return {
        sold: Number(d.sold ?? 0),
        totalRevenue: Number(d.totalRevenue ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byService: (d.byService ?? []).map((x: any) => ({ name: x.name, count: Number(x.count), revenue: Number(x.revenue) })),
      } as SalesAgg
    },
    ["reports-sales", clubId, from, to],
    { revalidate: 120 },
  )
  return run()
}

export type VisitsAgg = {
  total: number
  prevTotal: number
  byDay: { day: string; count: number }[]
  heatmap: number[][] // [7][24], Пн=0, час 0-23 (таймзона клуба)
}

/** Агрегация посещений за период (RPC reports_visits, кеш per-club+период). */
export async function getReportsVisits(
  clubId: string, from: string, to: string, prevFrom: string, prevTo: string,
): Promise<VisitsAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_visits", {
        p_club_id: clubId, p_from: from, p_to: to, p_prev_from: prevFrom, p_prev_to: prevTo,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const cell of (d.heatmap ?? []) as any[]) {
        const dow = Number(cell.d), hr = Number(cell.h)
        if (dow >= 0 && dow < 7 && hr >= 0 && hr < 24) grid[dow][hr] = Number(cell.c)
      }
      return {
        total: Number(d.total ?? 0),
        prevTotal: Number(d.prevTotal ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byDay: (d.byDay ?? []).map((x: any) => ({ day: x.day, count: Number(x.count) })),
        heatmap: grid,
      } as VisitsAgg
    },
    ["reports-visits", clubId, from, to, prevFrom, prevTo],
    { revalidate: 120 },
  )
  return run()
}

export type ClientsAgg = {
  total: number
  active: number
  expired: number
  newInPeriod: number
  prevNew: number
  gender: { total: number; male: number; female: number }
  bySource: { key: string; count: number }[]
  byDayNew: { day: string; count: number }[]
}

/** Агрегация клиентов за период (RPC reports_clients, кеш per-club+период). */
export async function getReportsClients(
  clubId: string, from: string, to: string, prevFrom: string, prevTo: string,
): Promise<ClientsAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_clients", {
        p_club_id: clubId, p_from: from, p_to: to, p_prev_from: prevFrom, p_prev_to: prevTo,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      const g = d.gender ?? {}
      return {
        total: Number(d.total ?? 0),
        active: Number(d.active ?? 0),
        expired: Number(d.expired ?? 0),
        newInPeriod: Number(d.newInPeriod ?? 0),
        prevNew: Number(d.prevNew ?? 0),
        gender: { total: Number(g.total ?? 0), male: Number(g.male ?? 0), female: Number(g.female ?? 0) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bySource: (d.bySource ?? []).map((x: any) => ({ key: x.key, count: Number(x.count) })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byDayNew: (d.byDayNew ?? []).map((x: any) => ({ day: x.day, count: Number(x.count) })),
      } as ClientsAgg
    },
    ["reports-clients", clubId, from, to, prevFrom, prevTo],
    { revalidate: 120 },
  )
  return run()
}

export type RenewalsAgg = {
  active: number
  expired: number
  expiring30: number
  expiring7: number
  top: { id: string; name: string; membershipName: string | null; daysLeft: number }[]
}

/** Агрегация продлений (RPC reports_renewals). Не зависит от периода — кеш per-club. */
export async function getReportsRenewals(clubId: string): Promise<RenewalsAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_renewals", { p_club_id: clubId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      return {
        active: Number(d.active ?? 0),
        expired: Number(d.expired ?? 0),
        expiring30: Number(d.expiring30 ?? 0),
        expiring7: Number(d.expiring7 ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        top: (d.top ?? []).map((x: any) => ({ id: x.id, name: x.name, membershipName: x.membershipName ?? null, daysLeft: Number(x.daysLeft) })),
      } as RenewalsAgg
    },
    ["reports-renewals", clubId],
    { revalidate: 120 },
  )
  return run()
}

export type DebtsAgg = {
  count: number
  total: number
  list: { id: string; clientName: string | null; clientPhone: string | null; amount: number; createdAt: string }[]
}

/** Агрегация долгов (RPC reports_debts). Не зависит от периода — кеш per-club. */
export async function getReportsDebts(clubId: string): Promise<DebtsAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_debts", { p_club_id: clubId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      return {
        count: Number(d.count ?? 0),
        total: Number(d.total ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        list: (d.list ?? []).map((x: any) => ({
          id: x.id, clientName: x.clientName ?? null, clientPhone: x.clientPhone ?? null,
          amount: Number(x.amount), createdAt: x.createdAt,
        })),
      } as DebtsAgg
    },
    ["reports-debts", clubId],
    { revalidate: 120 },
  )
  return run()
}

/** Агрегация персонала (RPC reports_staff). Не зависит от периода — кеш per-club. */
export async function getReportsStaff(clubId: string): Promise<ReportStaffRow[]> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_staff", { p_club_id: clubId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((x) => ({
        id: x.id,
        name: x.name,
        role: x.role,
        salary: Number(x.salary) || 0,
        clientCount: Number(x.clientCount) || 0,
        status: x.status,
      })) as ReportStaffRow[]
    },
    ["reports-staff", clubId],
    { revalidate: 120 },
  )
  return run()
}

export type AlertsAgg = {
  expiringSoonCount: number
  expiringSoonNames: string[]
  expiring7Count: number
  atRiskCount: number
  debtsCount: number
  debtTotal: number
}

/** Агрегация «Внимание» (RPC reports_alerts). Период-независимая — кеш per-club. */
export async function getReportsAlerts(clubId: string): Promise<AlertsAgg> {
  const run = unstable_cache(
    async () => {
      const s = createServiceClient()
      const { data } = await s.rpc("reports_alerts", { p_club_id: clubId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (data ?? {}) as any
      return {
        expiringSoonCount: Number(d.expiringSoonCount ?? 0),
        expiringSoonNames: (d.expiringSoonNames ?? []) as string[],
        expiring7Count: Number(d.expiring7Count ?? 0),
        atRiskCount: Number(d.atRiskCount ?? 0),
        debtsCount: Number(d.debtsCount ?? 0),
        debtTotal: Number(d.debtTotal ?? 0),
      } as AlertsAgg
    },
    ["reports-alerts", clubId],
    { revalidate: 120 },
  )
  return run()
}
