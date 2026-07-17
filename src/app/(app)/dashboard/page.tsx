import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getCurrentClub } from "@/lib/club"
import { DashboardBody, DashboardBodySkeleton } from "@/components/app/DashboardBody"

export default async function DashboardPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Оболочка рендерится мгновенно */}
      <h1
        className="text-2xl font-semibold tracking-[-0.144px]"
        style={{ color: "var(--on-dark)", lineHeight: "32px" }}
      >
        Дашборд
      </h1>

      {/* Данные стримятся, не блокируя первый рендер */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody clubId={club.clubId} />
      </Suspense>
    </div>
  )
}
