import { createClient } from "@/lib/supabase/server"

const TRIAL_OFFER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

export type TrialOffer = {
  code: string
  name: string
  description: string
  price: number
  oldPrice: number | null
  discountPercent: number | null
  currency: string
  period: string
  benefits: string[]
}

export type ProductOnboardingData = {
  showTour: boolean
  trialOfferEligible: boolean
  trialDaysLeft: number | null
  offer: TrialOffer | null
}

type Params = {
  clubId: string
  userId: string
  staffId: string | null
  role: string
  plan: string
  trialDaysLeft: number | null
  impersonating?: boolean
}

export async function getProductOnboardingData({
  clubId,
  userId,
  staffId,
  role,
  plan,
  trialDaysLeft,
  impersonating,
}: Params): Promise<ProductOnboardingData> {
  const empty = { showTour: false, trialOfferEligible: false, trialDaysLeft, offer: null }
  if (!staffId || role !== "owner" || impersonating) return empty

  const supabase = await createClient()
  const [{ data: staff }, { data: club }] = await Promise.all([
    supabase
      .from("staff")
      .select("product_tour_completed_at, trial_offer_last_seen_at")
      .eq("id", staffId)
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("clubs").select("settings").eq("id", clubId).maybeSingle(),
  ])

  if (!staff) return empty
  const settings = (club?.settings ?? {}) as Record<string, unknown>
  const showTour = settings.onboarding_completed === true && !staff.product_tour_completed_at
  const lastSeen = staff.trial_offer_last_seen_at
    ? new Date(staff.trial_offer_last_seen_at).getTime()
    : null
  const trialOfferEligible = plan === "trial"
    && trialDaysLeft !== null
    && trialDaysLeft > 0
    && (lastSeen === null || Date.now() - lastSeen >= TRIAL_OFFER_COOLDOWN_MS)

  if (!trialOfferEligible) return { showTour, trialOfferEligible, trialDaysLeft, offer: null }

  const { data: planOffer } = await supabase
    .from("plans")
    .select("code, name, description, price, old_price, discount_percent, currency, period, landing_benefits")
    .eq("is_active", true)
    .eq("is_archived", false)
    .eq("is_trial", false)
    .gt("price", 0)
    .order("is_recommended", { ascending: false })
    .order("is_popular", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    showTour,
    trialOfferEligible,
    trialDaysLeft,
    offer: planOffer ? {
      code: planOffer.code,
      name: planOffer.name,
      description: planOffer.description,
      price: Number(planOffer.price),
      oldPrice: planOffer.old_price === null ? null : Number(planOffer.old_price),
      discountPercent: planOffer.discount_percent,
      currency: planOffer.currency,
      period: planOffer.period,
      benefits: Array.isArray(planOffer.landing_benefits) ? planOffer.landing_benefits.slice(0, 4) : [],
    } : null,
  }
}
