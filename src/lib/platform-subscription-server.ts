import { createServiceClient } from "@/lib/supabase/service"
import {
  resolvePlatformSubscription,
  type PlatformSubscriptionState,
} from "@/lib/platform-subscription"

type RelatedPlan = { code: string; is_trial: boolean }

export type ClubSubscriptionRow = {
  plan: string
  status: string | null
  trial_expires_at: string | null
  plan_expires_at: string | null
  plans: RelatedPlan | RelatedPlan[] | null
}

export function resolveAuthoritativeClubSubscription(
  club: ClubSubscriptionRow,
  now = Date.now(),
): PlatformSubscriptionState & { planCode: string } {
  const related = Array.isArray(club.plans) ? club.plans[0] : club.plans
  const planCode = related?.code ?? club.plan
  const isTrial = related?.is_trial ?? planCode === "trial"
  const state = resolvePlatformSubscription({
    plan: isTrial ? "trial" : planCode,
    status: club.status ?? "suspended",
    trialExpiresAt: club.trial_expires_at,
    planExpiresAt: club.plan_expires_at,
    now,
  })
  return { ...state, planCode }
}

export async function getClubOperationalSubscription(
  clubId: string,
  db: ReturnType<typeof createServiceClient> = createServiceClient(),
): Promise<(PlatformSubscriptionState & { planCode: string }) | null> {
  const { data, error } = await db
    .from("clubs")
    .select("plan, status, trial_expires_at, plan_expires_at, plans(code, is_trial)")
    .eq("id", clubId)
    .maybeSingle()
  if (error || !data) return null
  return resolveAuthoritativeClubSubscription(data as unknown as ClubSubscriptionRow)
}

export async function clubHasOperationalPlatformAccess(
  clubId: string,
  db: ReturnType<typeof createServiceClient> = createServiceClient(),
): Promise<boolean> {
  const state = await getClubOperationalSubscription(clubId, db)
  return Boolean(state && !state.isLocked)
}
