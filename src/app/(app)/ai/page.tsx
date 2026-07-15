import { getCurrentClub } from "@/lib/club"
import { AiChat } from "@/components/app/AiChat"
import { redirect } from "next/navigation"

export const metadata = { title: "AI Аналитика — FitCRM" }

export default async function AiPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  return <AiChat />
}
