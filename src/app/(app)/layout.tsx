import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { getSidebarStats } from "@/lib/sidebar"
import { AppShell } from "@/components/app/AppShell"
import { DiagnosticsProvider } from "@/components/app/DiagnosticsProvider"
import { RealtimeProvider } from "@/components/app/RealtimeProvider"
import { getProductOnboardingData } from "@/lib/product-onboarding"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  // Жёсткая блокировка доступа: приостановленный клуб / истёкший триал / истёкший план.
  // Админ платформы в режиме impersonation блокировку не видит (чтобы помочь клубу).
  // Server-side request timestamp; it is intentionally stable for this render.
  // eslint-disable-next-line react-hooks/purity
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
  const productOnboarding = await getProductOnboardingData({
    clubId: club.clubId,
    userId: user.id,
    staffId: stats.staffId,
    role: club.role,
    plan: club.plan,
    trialDaysLeft: stats.trialDaysLeft,
    impersonating: club.impersonating,
  })

  return (
    <AppShell
      clubId={club.clubId}
      clubName={club.clubName}
      plan={club.plan}
      email={user.email ?? ""}
      stats={stats}
      permissions={club.permissions}
      planAccess={club.planAccess}
      role={club.role}
      impersonating={club.impersonating}
      lockReason={lockReason}
      productOnboarding={productOnboarding}
    >
      <DiagnosticsProvider />
      <RealtimeProvider clubId={club.clubId} />
      {children}
    </AppShell>
  )
}
