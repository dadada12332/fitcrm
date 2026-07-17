import { getCurrentClub } from "@/lib/club"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SupportClient } from "@/components/app/SupportClient"

export default async function KnowledgePage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  return (
    <Suspense fallback={null}>
      <SupportClient clubId={club.clubId} initialTab="kb" />
    </Suspense>
  )
}
