import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getSidebarStats } from "@/lib/sidebar"
import { AppShell } from "@/components/app/AppShell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const club = await getCurrentClub(user.id)
  if (!club) redirect("/onboarding")

  const { data: clubRow } = await supabase
    .from("clubs")
    .select("trial_expires_at")
    .eq("id", club.clubId)
    .maybeSingle()

  const stats = await getSidebarStats(club.clubId, user.id, clubRow?.trial_expires_at ?? null)

  return (
    <AppShell
      clubId={club.clubId}
      clubName={club.clubName}
      plan={club.plan}
      email={user.email ?? ""}
      stats={stats}
      permissions={club.permissions}
      role={club.role}
    >
      {children}
    </AppShell>
  )
}
