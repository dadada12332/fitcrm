import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getCurrentClub } from "@/lib/club"
import { DashboardBody, DashboardBodySkeleton } from "@/components/app/DashboardBody"
import { Download } from "lucide-react"

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
          <a href="/dashboard/export" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Скачать XLSX</span>
          </a>
        )}
      </div>

      {/* Данные стримятся, не блокируя первый рендер */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody clubId={club.clubId} />
      </Suspense>
    </div>
  )
}
