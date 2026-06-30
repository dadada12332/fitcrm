import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getDashboardData } from "@/lib/dashboard"
import { getPaymentsList } from "@/lib/payments"
import { redirect } from "next/navigation"
import { ExportButton } from "@/components/app/ExportButton"
import { QuickActions } from "@/components/app/QuickActions"
import { RevenueChart } from "@/components/app/RevenueChart"
import { ClientTimeline } from "@/components/app/ClientTimeline"
import { RecentPayments } from "@/components/app/RecentPayments"
import { AiInsights } from "@/components/app/AiInsights"
import type { TimelineVisit } from "@/components/app/ClientTimeline"

function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return "Доброе утро"
  if (h < 17) return "Добрый день"
  return "Добрый вечер"
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  const [d, userRes, recentPayments, visitsRes] = await Promise.all([
    getDashboardData(supabase, club.clubId),
    supabase.from("users").select("full_name").eq("id", user!.id).maybeSingle(),
    getPaymentsList(supabase, club.clubId, 8),
    supabase
      .from("visits")
      .select("id, checked_in_at, clients(id, full_name, tags)")
      .eq("club_id", club.clubId)
      .order("checked_in_at", { ascending: false })
      .limit(10),
  ])

  const firstName =
    ((userRes.data as any)?.full_name ?? "").split(" ")[0] || "Руководитель"

  const recentVisits: TimelineVisit[] = (visitsRes.data ?? []).map((v: any) => ({
    id: v.id as string,
    clientId: v.clients?.id ?? null,
    clientName: v.clients?.full_name ?? null,
    clientTags: v.clients?.tags ?? [],
    checkedInAt: v.checked_in_at as string,
  }))

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header (Figma: title + subtitle + buttons) ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold tracking-[-0.144px]" style={{ fontSize: 24, color: "var(--on-dark)" }}>
            Дашборд
          </h1>
          <p style={{ fontSize: 15, color: "var(--on-dark-soft)", marginTop: 2 }}>
            Выручка по дате, аналитика клуба и новые клиенты
          </p>
          {/* User improvement: personalized greeting */}
          <p style={{ fontSize: 13, color: "var(--gray-muted)", marginTop: 6 }}>
            {greetingText()}, {firstName} 👋
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <ExportButton />
          <QuickActions />
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Revenue chart — KPI above chart (user improvement) */}
          <RevenueChart periods={d.periods} />

          {/* Client activity — timeline instead of table (user improvement) */}
          <ClientTimeline
            visits={recentVisits}
            periods={d.periods}
            activeClients={d.activeClients}
            todayVisits={d.todayVisits}
            expiringCount={d.expiringCount}
            churnCount={d.churnCount}
          />
        </div>

        {/* Right column */}
        <div className="flex-shrink-0 flex flex-col gap-4" style={{ width: 510 }}>
          {/* Последние оплаты */}
          <RecentPayments payments={recentPayments} />

          {/* AI insights + chat */}
          <AiInsights
            attendanceChangePct={d.attendanceChangePct}
            churnCount={d.churnCount}
            expiringCount={d.expiringCount}
          />
        </div>

      </div>
    </div>
  )
}
