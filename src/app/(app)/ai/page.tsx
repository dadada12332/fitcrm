import { getCurrentClub } from "@/lib/club"
import { AiChat } from "@/components/app/AiChat"
import { redirect } from "next/navigation"
import { getBriefingAction } from "./actions"

export const metadata = { title: "AI Аналитика — FitCRM" }

export default async function AiPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.ai.use) redirect("/dashboard")
  const briefing = await getBriefingAction()
  return <AiChat initialBriefing={briefing} />
}
