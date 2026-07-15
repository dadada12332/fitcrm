import type { SupabaseClient } from "@supabase/supabase-js"

export type PaymentRow = {
  id: string
  clientId: string | null
  clientName: string | null
  clientPhone: string | null
  serviceName: string | null
  amount: number
  provider: "cash" | "click" | "payme" | "uzum"
  status: "pending" | "paid" | "failed" | "refunded"
  paidAt: string | null
  createdAt: string
}

export type PaymentsKPI = {
  todayRevenue: number
  todayRevenuePct: number
  monthRevenue: number
  monthRevenuePct: number
  avgCheck: number
  unpaidCount: number
}

export const providerMeta: Record<string, { label: string; color: string; bg: string }> = {
  cash:  { label: "Наличные", color: "#059669", bg: "rgba(5,150,105,0.12)" },
  click: { label: "Click",    color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  payme: { label: "Payme",    color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
  uzum:  { label: "Uzum",     color: "#d97706", bg: "rgba(217,119,6,0.12)" },
}

export const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  paid:     { label: "Оплачено", color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
  pending:  { label: "Ожидает",  color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  refunded: { label: "Возврат",  color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  failed:   { label: "Отменён",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
}

function pct(cur: number, prev: number) {
  if (!prev) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

export async function getPaymentsKPI(supabase: SupabaseClient, clubId: string): Promise<PaymentsKPI> {
  const { data, error } = await supabase.rpc("get_payments_kpi", { p_club_id: clubId })

  if (!error && data) {
    const d = data as {
      today_revenue: number
      yesterday_revenue: number
      month_revenue: number
      month_count: number
      prev_month_revenue: number
      unpaid_count: number
    }
    return {
      todayRevenue:    Number(d.today_revenue),
      todayRevenuePct: pct(Number(d.today_revenue), Number(d.yesterday_revenue)),
      monthRevenue:    Number(d.month_revenue),
      monthRevenuePct: pct(Number(d.month_revenue), Number(d.prev_month_revenue)),
      avgCheck: d.month_count ? Math.round(Number(d.month_revenue) / Number(d.month_count)) : 0,
      unpaidCount: Number(d.unpaid_count),
    }
  }

  // Fallback: parallel queries (used before RPC migration is applied)
  const now = new Date()
  const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [todayRes, yesterdayRes, monthRes, prevMonthRes, unpaidRes] = await Promise.all([
    supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid")
      .gte("paid_at", todayStart.toISOString()),
    supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid")
      .gte("paid_at", yesterdayStart.toISOString()).lt("paid_at", todayStart.toISOString()),
    supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid")
      .gte("paid_at", monthStart.toISOString()),
    supabase.from("payments").select("amount").eq("club_id", clubId).eq("status", "paid")
      .gte("paid_at", prevMonthStart.toISOString()).lt("paid_at", monthStart.toISOString()),
    supabase.from("payments").select("client_id", { count: "exact", head: true }).eq("club_id", clubId)
      .eq("status", "pending"),
  ])

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((a, r) => a + Number(r.amount), 0)

  const todayRev     = sum(todayRes.data)
  const yesterdayRev = sum(yesterdayRes.data)
  const monthRev     = sum(monthRes.data)
  const prevMonthRev = sum(prevMonthRes.data)
  const monthPaid    = monthRes.data ?? []

  return {
    todayRevenue:    todayRev,
    todayRevenuePct: pct(todayRev, yesterdayRev),
    monthRevenue:    monthRev,
    monthRevenuePct: pct(monthRev, prevMonthRev),
    avgCheck: monthPaid.length ? Math.round(monthRev / monthPaid.length) : 0,
    unpaidCount: unpaidRes.count ?? 0,
  }
}

// ── Серверная пагинация ───────────────────────────────────────
export type PaymentsQuery = {
  search?: string
  from?: string        // ISO нижняя граница периода
  provider?: string    // cash|click|payme|uzum
  status?: string      // paid|pending|failed|refunded
  sort?: string        // amount_desc|amount_asc|created_asc
  page?: number
  pageSize?: number
}
export type PaymentsPageResult = {
  rows: PaymentRow[]
  total: number
  totalAmount: number
  page: number
  pageSize: number
}
export const PAYMENTS_PAGE_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaymentRpc(p: any): PaymentRow {
  return {
    id: p.id,
    clientId: p.client_id ?? null,
    clientName: p.client_name ?? null,
    clientPhone: p.client_phone ?? null,
    serviceName: p.service_name ?? null,
    amount: Number(p.amount),
    provider: p.provider as PaymentRow["provider"],
    status: p.status as PaymentRow["status"],
    paidAt: p.paid_at ?? null,
    createdAt: p.created_at,
  }
}

export async function getPaymentsPage(
  supabase: SupabaseClient,
  clubId: string,
  q: PaymentsQuery,
): Promise<PaymentsPageResult> {
  const pageSize = q.pageSize ?? PAYMENTS_PAGE_SIZE
  const page = Math.max(0, q.page ?? 0)
  const args = {
    p_club_id: clubId,
    p_search: q.search?.trim() || null,
    p_from: q.from || null,
    p_provider: q.provider && q.provider !== "all" ? q.provider : null,
    p_status: q.status && q.status !== "all" ? q.status : null,
    p_sort: q.sort || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  }
  const res = await supabase.rpc("payments_page", args)
  if (res.error) {
    return inMemoryPaymentsPage(supabase, clubId, q, pageSize, page)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data = (res.data ?? []) as any[]
  let total = data.length > 0 ? Number(data[0].total_count) : 0
  let totalAmount = data.length > 0 ? Number(data[0].total_amount) : 0
  if (data.length === 0 && page > 0) {
    const retry = await supabase.rpc("payments_page", { ...args, p_offset: 0 })
    if (!retry.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data = (retry.data ?? []) as any[]
      total = data.length > 0 ? Number(data[0].total_count) : 0
      totalAmount = data.length > 0 ? Number(data[0].total_amount) : 0
    }
  }
  return {
    rows: data.map(mapPaymentRpc),
    total,
    totalAmount,
    page: data.length === 0 && page > 0 ? 0 : page,
    pageSize,
  }
}

async function inMemoryPaymentsPage(
  supabase: SupabaseClient,
  clubId: string,
  q: PaymentsQuery,
  pageSize: number,
  page: number,
): Promise<PaymentsPageResult> {
  const all = await getPaymentsList(supabase, clubId, 1000)
  const from = q.from ? new Date(q.from) : null
  const search = q.search?.trim().toLowerCase() ?? ""
  let filtered = all.filter((r) => {
    if (from && new Date(r.paidAt ?? r.createdAt) < from) return false
    if (q.provider && q.provider !== "all" && r.provider !== q.provider) return false
    if (q.status && q.status !== "all" && r.status !== q.status) return false
    if (search && !(r.clientName?.toLowerCase().includes(search) || r.serviceName?.toLowerCase().includes(search))) return false
    return true
  })
  if (q.sort === "amount_desc") filtered = [...filtered].sort((a, b) => b.amount - a.amount)
  else if (q.sort === "amount_asc") filtered = [...filtered].sort((a, b) => a.amount - b.amount)
  else if (q.sort === "created_asc") filtered = [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const total = filtered.length
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const start = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1)) * pageSize
  return { rows: filtered.slice(start, start + pageSize), total, totalAmount, page, pageSize }
}

export async function getPaymentsList(
  supabase: SupabaseClient,
  clubId: string,
  limit = 200
): Promise<PaymentRow[]> {
  const { data } = await supabase
    .from("payments")
    .select(`
      id, client_id, amount, provider, status, paid_at, created_at,
      clients(full_name, phone),
      subscriptions(memberships(name))
    `)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((p: any) => ({
    id: p.id,
    clientId: p.client_id ?? null,
    clientName: p.clients?.full_name ?? null,
    clientPhone: p.clients?.phone ?? null,
    serviceName: p.subscriptions?.memberships?.name ?? null,
    amount: Number(p.amount),
    provider: p.provider as PaymentRow["provider"],
    status: p.status as PaymentRow["status"],
    paidAt: p.paid_at ?? null,
    createdAt: p.created_at,
  }))
}
