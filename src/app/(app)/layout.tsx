import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { getSidebarStats } from "@/lib/sidebar"
import { AppShell } from "@/components/app/AppShell"
import { DiagnosticsProvider } from "@/components/app/DiagnosticsProvider"
import { RealtimeProvider } from "@/components/app/RealtimeProvider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  // Жёсткая блокировка доступа: приостановленный клуб / истёкший триал / истёкший план.
  // Админ платформы в режиме impersonation блокировку не видит (чтобы помочь клубу).
  const now = Date.now()
  const status = club.status
  const trialExp = club.trialExpiresAt ? new Date(club.trialExpiresAt).getTime() : null
  const planExp = club.planExpiresAt ? new Date(club.planExpiresAt).getTime() : null
  let lockReason: "suspended" | "trial" | "plan" | null = null
  if (!club.impersonating) {
    if (status === "suspended") lockReason = "suspended"
    else if (club.plan === "trial" && trialExp !== null && trialExp < now) lockReason = "trial"
    else if (club.plan !== "trial" && planExp !== null && planExp < now) lockReason = "plan"
  }

  const stats = await getSidebarStats(club.clubId, user.id, club.trialExpiresAt, user.user_metadata)

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
