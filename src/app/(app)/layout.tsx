import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { getSidebarStats } from "@/lib/sidebar"
import { AppShell } from "@/components/app/AppShell"
import { DiagnosticsProvider } from "@/components/app/DiagnosticsProvider"
import { RealtimeProvider } from "@/components/app/RealtimeProvider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  // status добавлен миграцией платформы; при её отсутствии — fallback без него.
  let clubRow: { trial_expires_at: string | null; plan_expires_at: string | null; status?: string | null } | null = null
  const full = await supabase
    .from("clubs")
    .select("trial_expires_at, plan_expires_at, status")
    .eq("id", club.clubId)
    .maybeSingle()
  if (full.error) {
    const fb = await supabase.from("clubs").select("trial_expires_at, plan_expires_at").eq("id", club.clubId).maybeSingle()
    clubRow = fb.data
  } else {
    clubRow = full.data
  }

  // Жёсткая блокировка доступа: приостановленный клуб / истёкший триал / истёкший план.
  // Админ платформы в режиме impersonation блокировку не видит (чтобы помочь клубу).
  const now = Date.now()
  const status = clubRow?.status ?? "active"
  const trialExp = clubRow?.trial_expires_at ? new Date(clubRow.trial_expires_at).getTime() : null
  const planExp = clubRow?.plan_expires_at ? new Date(clubRow.plan_expires_at).getTime() : null
  let lockReason: "suspended" | "trial" | "plan" | null = null
  if (!club.impersonating) {
    if (status === "suspended") lockReason = "suspended"
    else if (club.plan === "trial" && trialExp !== null && trialExp < now) lockReason = "trial"
    else if (club.plan !== "trial" && planExp !== null && planExp < now) lockReason = "plan"
  }

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
      impersonating={club.impersonating}
      lockReason={lockReason}
    >
      <DiagnosticsProvider />
      <RealtimeProvider clubId={club.clubId} />
      {children}
    </AppShell>
  )
}
