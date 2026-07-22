import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getCurrentClub } from "@/lib/club"
import { DashboardBody, DashboardBodySkeleton } from "@/components/app/DashboardBody"
import { DashboardExportButton } from "@/components/app/DashboardExportButton"

export default async function DashboardPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.dashboard.view) redirect("/settings")

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Оболочка рендерится мгновенно */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Дашборд</h1>
        {club.permissions.reports.export && club.permissions.dashboard.view_finance && (
          <DashboardExportButton />
        )}
      </div>

      {/* Данные стримятся, не блокируя первый рендер */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody clubId={club.clubId} />
      </Suspense>
    </div>
  )
}
