import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ClubSettings, type ClubData } from "@/components/app/ClubSettings"

export default async function ClubSettingsPage() {
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
      .select("id, role, users(id, email, raw_user_meta_data)")
      .eq("club_id", staffRow.club_id),
  ])

  const club = clubRes.data
  if (!club) redirect("/dashboard")

  const staffList = (staffListRes.data ?? []).map((s: any) => {
    const u = Array.isArray(s.users) ? s.users[0] : s.users
    return {
      id: s.id,
      name: u?.raw_user_meta_data?.full_name ?? u?.email?.split("@")[0] ?? "—",
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#020617" }}>Настройки клуба</h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Управление информацией, персоналом и тарифами</p>
      </div>
      <ClubSettings club={data} />
    </div>
  )
}
