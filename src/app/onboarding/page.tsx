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
    .select("club_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (staffRow?.club_id) redirect("/dashboard")

  return <OnboardingWizard clubName="" />
}
