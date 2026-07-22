import { getCurrentClub } from "@/lib/club"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SupportClient } from "@/components/app/SupportClient"
import { planFeatureEnabled, planSectionEnabled } from "@/lib/plan-access"

export default async function KnowledgePage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!planSectionEnabled(club.planAccess, "knowledge") || !planFeatureEnabled(club.planAccess, "knowledge")) redirect("/dashboard")
  return (
    <Suspense fallback={null}>
      <SupportClient clubId={club.clubId} initialTab="kb" />
    </Suspense>
  )
}
