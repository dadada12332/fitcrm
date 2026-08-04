export const PLATFORM_SUBSCRIPTION_WARNING_DAYS = 7

export type PlatformSubscriptionKind =
  | "suspended"
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "active"
  | "expiring"
  | "expired"
  | "unlimited"

export type PlatformSubscriptionState = {
  kind: PlatformSubscriptionKind
  expiresAt: string | null
  daysLeft: number | null
  isTrial: boolean
  isExpired: boolean
  isExpiring: boolean
  isLocked: boolean
  needsAttention: boolean
  canRenew: boolean
}

type PlatformSubscriptionInput = {
  plan: string
  status: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  now?: number
}

/**
 * Resolves the SaaS subscription lifecycle independently from the assigned
 * plan. `clubs.plan` intentionally remains the last selected plan after its
 * paid period ends, so it must never be used as an "active" flag on its own.
 */
export function resolvePlatformSubscription({
  plan,
  status,
  trialExpiresAt,
  planExpiresAt,
  now = Date.now(),
}: PlatformSubscriptionInput): PlatformSubscriptionState {
  const isTrial = plan === "trial"
  const expiresAt = isTrial ? trialExpiresAt : planExpiresAt

  // Only an explicitly active club can enter the ordinary subscription
  // lifecycle. Deleted/unknown administrative states fail closed through the
  // support-only lock path just like a manual suspension.
  if (status !== "active") {
    return {
      kind: "suspended",
      expiresAt,
      daysLeft: resolveDaysLeft(expiresAt, now),
      isTrial,
      isExpired: false,
      isExpiring: false,
      isLocked: true,
      needsAttention: false,
      canRenew: false,
    }
  }

  if (!expiresAt) {
    // Trials are always time-boxed. A missing trial expiry is incomplete
    // billing data and must not accidentally grant an unlimited free period.
    if (isTrial) {
      return {
        kind: "trial_expired",
        expiresAt: null,
        daysLeft: 0,
        isTrial: true,
        isExpired: true,
        isExpiring: false,
        isLocked: true,
        needsAttention: true,
        canRenew: true,
      }
    }
    return {
      kind: "unlimited",
      expiresAt: null,
      daysLeft: null,
      isTrial: false,
      isExpired: false,
      isExpiring: false,
      isLocked: false,
      needsAttention: false,
      canRenew: false,
    }
  }

  const expiresAtMs = new Date(expiresAt).getTime()
  // A malformed non-null expiry is a billing-data failure, not a free
  // unlimited subscription. Fail closed and surface the renewal path.
  const expired = !Number.isFinite(expiresAtMs) || expiresAtMs <= now
  const daysLeft = expired ? 0 : Math.ceil((expiresAtMs - now) / 86_400_000)
  const expiring = !expired && daysLeft <= PLATFORM_SUBSCRIPTION_WARNING_DAYS

  return {
    kind: expired
      ? isTrial ? "trial_expired" : "expired"
      : expiring
        ? isTrial ? "trial_expiring" : "expiring"
        : isTrial ? "trial_active" : "active",
    expiresAt,
    daysLeft,
    isTrial,
    isExpired: expired,
    isExpiring: expiring,
    isLocked: expired,
    needsAttention: expired || expiring,
    canRenew: true,
  }
}

function resolveDaysLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null
  const expiresAtMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return 0
  return Math.ceil((expiresAtMs - now) / 86_400_000)
}
