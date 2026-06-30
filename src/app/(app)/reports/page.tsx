import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getReportsData } from "@/lib/reports"
import { ReportsClient } from "@/components/app/ReportsClient"
import { redirect } from "next/navigation"

export default async function ReportsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  const data = await getReportsData(supabase, club.clubId)
  return <ReportsClient data={data} />
}
