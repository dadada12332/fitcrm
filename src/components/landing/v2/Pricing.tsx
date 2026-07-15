import { getPlans, planBenefits } from "@/lib/plans"
import { PricingCards, type LandingPlan } from "./PricingCards"

// Лендинг берёт тарифы напрямую из БД (раздел «Тарифы» в Platform Admin).
// Изменения цен/названий/преимуществ применяются без деплоя (кеш ~60 c).
export async function Pricing() {
  const plans = await getPlans() // только активные, не архивные

  const landing: LandingPlan[] = plans.map((p) => {
    return {
      code: p.code,
      name: p.name,
      subtitle: p.landing_subtitle,
      price: p.price,
      oldPrice: p.old_price,
      currency: p.currency,
      period: p.period,
      popular: p.is_popular || p.is_recommended,
      color: p.color,
      cta: p.landing_cta || "Начать",
      isTrial: p.is_trial,
      trialDays: p.trial_days,
      benefits: planBenefits(p),
    }
  })

  return <PricingCards plans={landing} />
}
