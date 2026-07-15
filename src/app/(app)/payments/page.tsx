import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getPaymentsKPI, getPaymentsPage, PAYMENTS_PAGE_SIZE } from "@/lib/payments"
import { getActiveMemberships } from "@/lib/memberships"
import { PaymentsClient } from "@/components/app/PaymentsClient"
import { TrendingUp, TrendingDown, DollarSign, Receipt, Users } from "lucide-react"
import { redirect } from "next/navigation"

function fmtSum(n: number) { return n.toLocaleString("ru-RU") }

function periodFrom(period: string): string {
  const d = new Date()
  if (period === "today") d.setHours(0, 0, 0, 0)
  else if (period === "week") d.setDate(d.getDate() - 7)
  else if (period === "year") { d.setMonth(0); d.setDate(1); d.setHours(0, 0, 0, 0) }
  else { d.setDate(1); d.setHours(0, 0, 0, 0) } // month (default)
  return d.toISOString()
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.payments.view) redirect("/dashboard")

  const sp = await searchParams
  const period = sp.period ?? "month"
  const query = {
    search: sp.q ?? "",
    from: periodFrom(period),
    provider: sp.provider,
    status: sp.status,
    sort: sp.sort,
    page: Math.max(0, parseInt(sp.page ?? "0", 10) || 0),
    pageSize: PAYMENTS_PAGE_SIZE,
  }

  const [kpi, result, memberships] = await Promise.all([
    getPaymentsKPI(supabase, club.clubId),
    getPaymentsPage(supabase, club.clubId, query),
    getActiveMemberships(supabase, club.clubId),
  ])

  // Какие онлайн-платёжки подключены (для опции «онлайн-оплата»).
  const { createServiceClient } = await import("@/lib/supabase/service")
  const { data: creds } = await createServiceClient()
    .from("club_payment_credentials").select("provider, enabled").eq("club_id", club.clubId).eq("enabled", true)
  const connectedProviders = (creds ?? []).map((c: { provider: string }) => c.provider)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Оплаты</h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Финансовый контроль клуба</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[
          {
            label: "Выручка сегодня", icon: DollarSign,
            value: <>{fmtSum(kpi.todayRevenue)} <span className="text-lg font-normal" style={{ color: "var(--gray-muted)" }}>сум</span></>,
            delta: kpi.todayRevenuePct !== undefined ? (
              <div className="flex items-center gap-1.5">
                {kpi.todayRevenuePct >= 0
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: kpi.todayRevenuePct >= 0 ? "#16a34a" : "#dc2626" }}>
                  {kpi.todayRevenuePct >= 0 ? "+" : ""}{kpi.todayRevenuePct}%
                </span>
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>к прошлому периоду</span>
              </div>
            ) : null,
          },
          {
            label: "Выручка за месяц", icon: TrendingUp,
            value: <>{fmtSum(kpi.monthRevenue)} <span className="text-lg font-normal" style={{ color: "var(--gray-muted)" }}>сум</span></>,
            delta: kpi.monthRevenuePct !== undefined ? (
              <div className="flex items-center gap-1.5">
                {kpi.monthRevenuePct >= 0
                  ? <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
                  : <TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
                <span className="text-xs font-medium" style={{ color: kpi.monthRevenuePct >= 0 ? "#16a34a" : "#dc2626" }}>
                  {kpi.monthRevenuePct >= 0 ? "+" : ""}{kpi.monthRevenuePct}%
                </span>
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>к прошлому месяцу</span>
              </div>
            ) : null,
          },
          {
            label: "Средний чек", icon: Receipt,
            value: <>{fmtSum(kpi.avgCheck)} <span className="text-lg font-normal" style={{ color: "var(--gray-muted)" }}>сум</span></>,
            delta: null,
          },
          {
            label: "Ожидают оплаты", icon: Users,
            value: <>{kpi.unpaidCount} <span className="text-lg font-normal" style={{ color: "var(--gray-muted)" }}>платежей</span></>,
            delta: null,
          },
        ].map(({ label, value, icon: Icon, delta }, i) => (
          <div key={label} className="p-5 flex flex-col gap-3"
            style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Icon className="w-5 h-5" style={{ color: "var(--gray-muted)" }} />
            </div>
            <span className="text-3xl font-semibold tracking-[-0.27px]" style={{ color: "var(--on-dark)" }}>{value}</span>
            {delta}
          </div>
        ))}
      </div>

      {/* Table + filters (серверная пагинация) */}
      <PaymentsClient
        rows={result.rows}
        total={result.total}
        totalAmount={result.totalAmount}
        page={result.page}
        pageSize={result.pageSize}
        memberships={memberships}
        connectedProviders={connectedProviders}
      />
    </div>
  )
}
