import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClubForRecovery } from "@/lib/club"
import { getSidebarStats } from "@/lib/sidebar"
import { AppShell } from "@/components/app/AppShell"
import { DiagnosticsProvider } from "@/components/app/DiagnosticsProvider"
import { RealtimeProvider } from "@/components/app/RealtimeProvider"
import { getProductOnboardingData } from "@/lib/product-onboarding"
import { getUnreadPlatformAnnouncementCount } from "@/lib/platform-announcements"
import { resolvePlatformSubscription } from "@/lib/platform-subscription"
import {
  ServerSubscriptionLockScreen,
  type SubscriptionLockReason,
} from "@/components/app/ServerSubscriptionLockScreen"
import type { SidebarStats } from "@/lib/sidebar"

export type RecoveryMode = "subscription" | "support" | null

export async function AppLayoutFrame({
  children,
  recoveryMode = null,
}: {
  children: React.ReactNode
  recoveryMode?: RecoveryMode
}) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const club = await getCurrentClubForRecovery()
  if (!club) redirect("/onboarding")

  const subscriptionState = resolvePlatformSubscription({
    plan: club.plan,
    status: club.status,
    trialExpiresAt: club.trialExpiresAt,
    planExpiresAt: club.planExpiresAt,
  })
  let lockReason: SubscriptionLockReason | null = null
  if (!club.impersonating) {
    if (subscriptionState.kind === "suspended") lockReason = "suspended"
    else if (subscriptionState.kind === "trial_expired") lockReason = "trial"
    else if (subscriptionState.kind === "expired") lockReason = "plan"
  }

  const canManageSubscription = club.permissions.settings.subscription
  const recoveryAllowed = recoveryMode === "support"
    || (recoveryMode === "subscription"
      && lockReason !== "suspended"
      && canManageSubscription)

  // Do not pass a protected page's Server Component children through a client
  // boundary. Otherwise its data can be serialized into the Flight payload
  // even when a client-only lock screen paints over it.
  if (lockReason && !recoveryAllowed) {
    return (
      <ServerSubscriptionLockScreen
        reason={lockReason}
        clubName={club.clubName}
        plan={club.plan}
        locale={club.locale}
        canManageSubscription={canManageSubscription}
      />
    )
  }

  // Recovery pages deliberately receive identity-only shell data. Do not load
  // or serialize operational CRM aggregates, onboarding state, announcements,
  // diagnostics, or Realtime while the subscription boundary is locked.
  if (lockReason && recoveryAllowed) {
    const metadata = user.user_metadata ?? {}
    const roleLabels: Record<string, string> = {
      owner: "Владелец",
      manager: "Менеджер",
      admin: "Администратор",
      trainer: "Тренер",
    }
    const safeStats: SidebarStats = {
      clientCount: 0,
      activeMembershipCount: 0,
      todayVisits: 0,
      lowStockCount: 0,
      userName: String(metadata.full_name ?? user.email?.split("@")[0] ?? "Пользователь"),
      userRole: roleLabels[club.role] ?? "Сотрудник",
      trialDaysLeft: subscriptionState.isTrial ? subscriptionState.daysLeft : null,
      staffId: null,
      avatarPreset: typeof metadata.avatar_preset === "string" ? metadata.avatar_preset : null,
      avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      supportUnread: 0,
      inboxUnread: 0,
      notificationCount: 0,
    }

    return (
      <AppShell
        clubId={club.clubId}
        clubName={club.clubName}
        plan={club.plan}
        email={user.email ?? ""}
        stats={safeStats}
        permissions={club.permissions}
        planAccess={club.planAccess}
        locale={club.locale}
        currency={club.currency}
        timezone={club.timezone}
        role={club.role}
        lockReason={lockReason}
        subscriptionState={subscriptionState}
        canManageSubscription={canManageSubscription}
        productOnboarding={{
          showTour: false,
          trialOfferEligible: false,
          trialDaysLeft: safeStats.trialDaysLeft,
          offer: null,
        }}
        recoveryOnly
      >
        {children}
      </AppShell>
    )
  }

  const [stats, platformUnread] = await Promise.all([
    getSidebarStats(club.clubId, user.id, club.trialExpiresAt, user.user_metadata),
    getUnreadPlatformAnnouncementCount(club.clubId, user.id),
  ])
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
      stats={{
        ...stats,
        notificationCount: stats.notificationCount
          + platformUnread
          + (canManageSubscription && subscriptionState.needsAttention ? 1 : 0),
      }}
      permissions={club.permissions}
      planAccess={club.planAccess}
      locale={club.locale}
      currency={club.currency}
      timezone={club.timezone}
      role={club.role}
      impersonating={club.impersonating}
      lockReason={lockReason}
      subscriptionState={subscriptionState}
      canManageSubscription={canManageSubscription}
      productOnboarding={productOnboarding}
    >
      <DiagnosticsProvider />
      <RealtimeProvider clubId={club.clubId} />
      {children}
    </AppShell>
  )
}
