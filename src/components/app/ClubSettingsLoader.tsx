import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { redirect } from "next/navigation"
import { ClubSettings, type ClubData } from "./ClubSettings"

type Section = "basic" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "security" | "plan"

export async function ClubSettingsLoader({ section }: { section: Section }) {
  const supabase = await createClient()

  // getCurrentClub() is cache()-wrapped — hits cache if page already called it
  const club = await getCurrentClub()
  if (!club) redirect("/dashboard")

  // Single query: club + staff + users via nested PostgREST select (3 queries → 1)
  const { data: clubRow } = await supabase
    .from("clubs")
    .select("id, name, plan, trial_expires_at, plan_expires_at, settings, staff!inner(id, role, user_id, is_active, users(id, email, full_name))")
    .eq("id", club.clubId)
    .single()

  if (!clubRow) redirect("/dashboard")

  const { data: { user } } = await supabase.auth.getUser()

  const staffList = ((clubRow as any).staff ?? [])
    .filter((s: any) => s.is_active)
    .map((s: any) => {
      const u = s.users as any
      return {
        id: s.id,
        name: u?.full_name ?? u?.email?.split("@")[0] ?? "—",
        role: s.role,
        email: u?.email ?? "",
        isMe: s.user_id === user?.id,
      }
    })

  const data: ClubData = {
    id: (clubRow as any).id,
    name: (clubRow as any).name,
    plan: (clubRow as any).plan ?? "trial",
    trialExpiresAt: (clubRow as any).trial_expires_at ?? null,
    planExpiresAt: (clubRow as any).plan_expires_at ?? null,
    settings: ((clubRow as any).settings as ClubData["settings"]) ?? {},
    currentRole: club.role,
    staffList,
  }

  return <ClubSettings club={data} section={section} />
}
