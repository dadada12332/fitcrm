import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "./OnboardingWizard"

export default async function OnboardingPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  // Прямой запрос к staff — не зависит от RPC get_layout_context
  const supabase = await createClient()
  const { data: staffRow } = await supabase
    .from("staff")
    .select("club_id, clubs(name, settings)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const club = Array.isArray(staffRow?.clubs) ? staffRow.clubs[0] : staffRow?.clubs
  const settings = (club?.settings as Record<string, unknown> | null) ?? {}
  if (staffRow?.club_id && settings.onboarding_started !== true) redirect("/dashboard")
  if (settings.onboarding_completed === true) redirect("/dashboard")

  const pendingClubName = typeof user.user_metadata?.pending_club_name === "string"
    ? user.user_metadata.pending_club_name
    : ""
  const initialStep = typeof settings.onboarding_step === "number"
    ? Math.min(4, Math.max(1, settings.onboarding_step))
    : 1

  return <OnboardingWizard clubName={club?.name ?? pendingClubName} initialStep={initialStep} />
}
