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

function startOf(d: Date, unit: "day" | "month") {
  const r = new Date(d)
  if (unit === "day") { r.setHours(0, 0, 0, 0) }
  else { r.setDate(1); r.setHours(0, 0, 0, 0) }
  return r
}

export async function getPaymentsKPI(supabase: SupabaseClient, clubId: string): Promise<PaymentsKPI> {
  const now = new Date()
  const todayStart    = startOf(now, "day")
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart    = startOf(now, "month")
  const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

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

  const todayRev    = sum(todayRes.data)
  const yesterdayRev = sum(yesterdayRes.data)
  const monthRev    = sum(monthRes.data)
  const prevMonthRev = sum(prevMonthRes.data)

  const monthPaid = (monthRes.data ?? [])
  const avgCheck = monthPaid.length ? Math.round(monthRev / monthPaid.length) : 0

  function pct(cur: number, prev: number) {
    if (!prev) return cur > 0 ? 100 : 0
    return Math.round(((cur - prev) / prev) * 100)
  }

  return {
    todayRevenue:    todayRev,
    todayRevenuePct: pct(todayRev, yesterdayRev),
    monthRevenue:    monthRev,
    monthRevenuePct: pct(monthRev, prevMonthRev),
    avgCheck,
    unpaidCount: unpaidRes.count ?? 0,
  }
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
