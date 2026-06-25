import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ClubSettings, type ClubData } from "./ClubSettings"

type Section = "basic" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "security" | "plan"

export async function ClubSettingsLoader({ section }: { section: Section }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: staffRow } = await supabase
    .from("staff")
    .select("club_id, role")
    .eq("user_id", user.id)
    .single()

  if (!staffRow?.club_id) redirect("/dashboard")

  const [clubRes, staffListRes] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, plan, trial_expires_at, plan_expires_at, settings")
      .eq("id", staffRow.club_id)
      .single(),
    supabase
      .from("staff")
      .select("id, user_id, role")
      .eq("club_id", staffRow.club_id),
  ])

  const club = clubRes.data
  if (!club) redirect("/dashboard")

  const userIds = (staffListRes.data ?? []).map((s: any) => s.user_id as string)
  const { data: usersData } = userIds.length > 0
    ? await supabase.from("users").select("id, email, full_name").in("id", userIds)
    : { data: [] }
  const usersMap = new Map((usersData ?? []).map((u: any) => [u.id, u]))

  const staffList = (staffListRes.data ?? []).map((s: any) => {
    const u = usersMap.get(s.user_id) as any
    return {
      id: s.id,
      name: u?.full_name ?? u?.email?.split("@")[0] ?? "—",
      role: s.role,
      email: u?.email ?? "",
    }
  })

  const data: ClubData = {
    id: club.id,
    name: club.name,
    plan: club.plan ?? "trial",
    trialExpiresAt: club.trial_expires_at ?? null,
    planExpiresAt: club.plan_expires_at ?? null,
    settings: (club.settings as ClubData["settings"]) ?? {},
    staffList,
  }

  return <ClubSettings club={data} section={section} />
}
