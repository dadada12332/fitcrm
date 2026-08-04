import { getCurrentClubForRecovery } from "@/lib/club"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { SupportClient } from "@/components/app/SupportClient"

export const metadata = { title: "Поддержка — Zalkins" }

export default async function SupportPage() {
  const club = await getCurrentClubForRecovery()
  if (!club) redirect("/onboarding")
  return (
    <Suspense fallback={null}>
      <SupportClient clubId={club.clubId} />
    </Suspense>
  )
}
