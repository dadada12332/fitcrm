import { getCurrentClub } from "@/lib/club"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SupportClient } from "@/components/app/SupportClient"

export const metadata = { title: "Поддержка — FitCRM" }

export default async function SupportPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  return (
    <Suspense fallback={null}>
      <SupportClient clubId={club.clubId} />
    </Suspense>
  )
}
