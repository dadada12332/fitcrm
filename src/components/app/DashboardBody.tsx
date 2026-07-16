import { createClient } from "@/lib/supabase/server"
import { getDashboardData } from "@/lib/dashboard"
import { getPaymentsList } from "@/lib/payments"
import { DashboardTiles } from "@/components/app/DashboardTiles"
import { RevenueChart, DashboardVisitRadial } from "@/components/app/LazyCharts"
import { RecentPayments } from "@/components/app/RecentPayments"
import { DashboardAICards } from "@/components/app/DashboardAICards"

/** Тело дашборда — грузит данные и стримится под Suspense (оболочка рендерится мгновенно). */
export async function DashboardBody({ clubId }: { clubId: string }) {
  const supabase = await createClient()
  const [d, recentPayments] = await Promise.all([
    getDashboardData(supabase, clubId),
    getPaymentsList(supabase, clubId, 8),
  ])

  return (
    <>
      <DashboardTiles
        activeClients={d.activeClients}
        prevClients={d.prevClients}
        todayRevenue={d.todayRevenue}
        prevRevenue={d.prevRevenue}
        todayVisits={d.todayVisits}
        prevVisits={d.prevVisits}
        expiringCount={d.expiringCount}
      />

      <div className="flex items-stretch gap-4" style={{ minHeight: 400 }}>
        <RevenueChart periods={d.periods} />
        <DashboardVisitRadial
          todayVisits={d.todayVisits}
          activeClients={d.activeClients}
          attendanceChangePct={d.attendanceChangePct}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentPayments payments={recentPayments} />
        <DashboardAICards
          attendanceChangePct={d.attendanceChangePct}
          expiringCount={d.expiringCount}
          churnCount={d.churnCount}
          todayRevenue={d.todayRevenue}
          prevRevenue={d.prevRevenue}
        />
      </div>
    </>
  )
}

/** Скелетон тела на время стриминга. */
export function DashboardBodySkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      <div className="flex items-stretch gap-4">
        <div className="flex-1 h-[400px] rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        <div className="w-[320px] h-[400px] rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        <div className="h-64 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
      </div>
    </div>
  )
}
