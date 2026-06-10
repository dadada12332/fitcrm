import { createClient } from "@/lib/supabase/server"
import { ChevronDown } from "lucide-react"
import { StatisticsWidget } from "@/components/app/StatisticsWidget"

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
  const prev30 = new Date(now); prev30.setDate(now.getDate() - 30)
  const next7 = new Date(now); next7.setDate(now.getDate() + 7)
  const prev7 = new Date(now); prev7.setDate(now.getDate() - 7)

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
  ])

  const todayRevenue = (todayPayRes.data ?? []).reduce((s, p: { amount: number }) => s + Number(p.amount ?? 0), 0)
  const prevRevenue = (yesterdayPayRes.data ?? []).reduce((s, p: { amount: number }) => s + Number(p.amount ?? 0), 0)
  const activeClients = activeClientsRes.count ?? 0
  const prevClients = prevMonthClientsRes.count ?? 0
  const todayVisits = todayVisitsRes.count ?? 0
  const prevVisits = yesterdayVisitsRes.count ?? 0
  const expiringCount = expiringRes.count ?? 0
  const churnCount = churnRes.count ?? 0
  const alertsCount = expiringCount + churnCount

  // Chart: group by day last 30 days
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

  // Clients progress bar data
  const attended = todayVisits
  const active = Math.max(0, activeClients - attended)
  const total = activeClients || 1
  const attendedPct = Math.round((attended / total) * 100)
  const expiringPct = Math.round((expiringCount / total) * 100)
  const restPct = Math.max(0, 100 - attendedPct - expiringPct)

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "#020617" }}>
          Дашборд
        </h1>
        <button
          className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "#0f172a", color: "#f8fafc" }}
        >
          Быстрые действия
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* ── Клиенты progress card ── */}
      <div
        className="w-full rounded-lg p-6 flex flex-col gap-6"
        style={{ background: "white", border: "1px solid #e2e8f0" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "#020617" }}>
            Клиенты
          </span>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#16a34a" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>
                {attended} (Пришли сегодня)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#ffb700" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>
                {expiringCount} (Истекают скоро)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#dc2626" }} />
              <span className="text-sm font-medium" style={{ color: "#64748b" }}>
                {active} (Не пришли)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 h-1 w-full rounded-lg overflow-hidden">
          {attendedPct > 0 && (
            <div className="h-full rounded-lg" style={{ background: "#16a34a", width: `${attendedPct}%` }} />
          )}
          {expiringPct > 0 && (
            <div className="h-full rounded-lg ml-0.5" style={{ background: "#ffb700", width: `${expiringPct}%` }} />
          )}
          {restPct > 0 && (
            <div className="h-full rounded-lg ml-0.5" style={{ background: "#dc2626", width: `${restPct}%` }} />
          )}
        </div>
      </div>

      {/* ── Статистика ── */}
      <StatisticsWidget
        todayRevenue={todayRevenue}
        prevRevenue={prevRevenue}
        activeClients={activeClients}
        prevClients={prevClients}
        todayVisits={todayVisits}
        prevVisits={prevVisits}
        alertsCount={alertsCount}
        expiringCount={expiringCount}
        churnCount={churnCount}
        chartData={chartData}
      />

    </div>
  )
}
