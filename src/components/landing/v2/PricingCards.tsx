"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const ru = (n: number) => new Intl.NumberFormat("ru-RU").format(n)
const YEAR_DISCOUNT = 0.2

export type LandingPlan = {
  code: string
  name: string
  subtitle: string
  price: number
  oldPrice: number | null
  currency: string
  period: string
  popular: boolean
  color: string
  cta: string
  isTrial: boolean
  trialDays: number
  benefits: string[]
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay },
})

function PlanCheck({ children, featured }: { children: React.ReactNode; featured: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ${featured ? "bg-brand text-white" : "bg-muted text-foreground"}`}>
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className={`text-sm leading-5 ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{children}</span>
    </li>
  )
}

export function PricingCards({ plans }: { plans: LandingPlan[] }) {
  const t = useT()
  const [billing, setBilling] = useState<"month" | "year">("year")
  const paid = plans.filter((plan) => !plan.isTrial)
  const featuredCode =
    plans.find((plan) => plan.code.toLowerCase() === "standard")?.code ??
    plans.find((plan) => plan.popular)?.code ??
    [...paid].sort((a, b) => b.price - a.price)[0]?.code
  const colClass = plans.length >= 4 ? "lg:grid-cols-2 min-[1680px]:grid-cols-4" : "lg:grid-cols-3"

  const planName = (plan: LandingPlan) => {
    const code = plan.code.toLowerCase() as keyof typeof t.pricing.planNames
    return t.pricing.planNames[code] ?? plan.name
  }

  return (
    <section id="pricing" className="relative bg-background py-24 md:py-32">
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[760px] text-center">
          <motion.p {...fadeUp()} className="font-mono text-xs font-medium tracking-normal text-brand">{t.pricing.eyebrow}</motion.p>
          <motion.h2 {...fadeUp(0.04)} className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-normal text-foreground md:text-[52px]">{t.pricing.title}</motion.h2>
          <motion.p {...fadeUp(0.08)} className="mx-auto mt-4 max-w-[650px] text-[17px] leading-7 text-muted-foreground">{t.pricing.subtitle}</motion.p>
        </div>

        <motion.div {...fadeUp(0.12)} className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {t.pricing.badges.map((badge) => (
            <div key={badge} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} /></span>
              {badge}
            </div>
          ))}
        </motion.div>

        <motion.div {...fadeUp(0.16)} className="mt-10 flex justify-center">
          <div className="inline-flex min-h-12 items-center rounded-xl border border-border bg-muted p-1" role="group" aria-label={t.pricing.billingLabel}>
            <button type="button" onClick={() => setBilling("month")} aria-pressed={billing === "month"} className={`h-10 rounded-lg px-5 text-sm font-medium transition-all ${billing === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.pricing.monthly}
            </button>
            <button type="button" onClick={() => setBilling("year")} aria-pressed={billing === "year"} className={`flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-all ${billing === "year" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.pricing.yearly}
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${billing === "year" ? "bg-brand text-white" : "bg-chart-2/10 text-chart-2"}`}>{t.pricing.off}</span>
            </button>
          </div>
        </motion.div>

        <div className={`mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 ${colClass} lg:items-stretch xl:gap-6`}>
          {plans.map((plan, index) => {
            const featured = plan.code === featuredCode
            const free = plan.isTrial || plan.price === 0
            const shown = billing === "year" ? Math.round(plan.price * (1 - YEAR_DISCOUNT)) : plan.price
            const annualTotal = shown * 12
            const displayName = planName(plan)
            const cta = free ? t.pricing.startFree : featured ? t.pricing.chooseStandard : t.pricing.choosePlan(displayName)

            return (
              <motion.article key={plan.code} {...fadeUp(0.14 + index * 0.05)} className={`relative flex min-h-[610px] flex-col overflow-hidden rounded-2xl border p-6 sm:p-7 ${featured ? "border-primary bg-primary text-primary-foreground shadow-2xl shadow-foreground/15 lg:-translate-y-3" : "border-border bg-card text-card-foreground"}`}>
                {featured && <div className="absolute inset-x-0 top-0 h-1 bg-brand" />}

                <div className="flex min-h-8 items-center justify-between gap-3">
                  <p className={`text-sm font-medium ${featured ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{free ? t.pricing.trialLabel : t.pricing.planLabel}</p>
                  {featured && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white"><Sparkles className="size-3.5" />{t.pricing.bestChoice}</span>
                  )}
                </div>

                <h3 className={`mt-4 text-2xl font-semibold tracking-normal ${featured ? "text-primary-foreground" : "text-foreground"}`}>{displayName}</h3>
                <p className={`mt-2 min-h-10 text-sm leading-5 ${featured ? "text-primary-foreground/65" : "text-muted-foreground"}`}>{featured ? t.pricing.standardPitch : plan.subtitle || t.pricing.included}</p>

                <div className="mt-7 min-h-[88px]">
                  {free ? (
                    <><p className="text-[38px] font-semibold leading-none tracking-normal">{t.pricing.free}</p><p className={`mt-3 text-sm ${featured ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{t.pricing.trialDays(plan.trialDays)}</p></>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-1"><span className="text-[38px] font-semibold leading-none tracking-normal tabular-nums">{ru(shown)}</span><span className={`pb-0.5 text-sm ${featured ? "text-primary-foreground/55" : "text-muted-foreground"}`}>{t.pricing.perMonth}</span></div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {billing === "year" ? <><span className={featured ? "text-primary-foreground/60" : "text-muted-foreground"}>{t.pricing.perYear(ru(annualTotal))}</span><span className={`rounded px-1.5 py-0.5 font-semibold ${featured ? "bg-brand/25 text-primary-foreground" : "bg-chart-2/10 text-chart-2"}`}>{t.pricing.save}</span></> : <span className={featured ? "text-primary-foreground/55" : "text-muted-foreground"}>{t.pricing.noVat}</span>}
                      </div>
                    </>
                  )}
                </div>

                {featured && (
                  <div className="mt-5 flex items-start gap-3 rounded-lg border border-primary-foreground/15 bg-primary-foreground/[0.06] p-3.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                    <p className="text-xs leading-5 text-primary-foreground/75">{t.pricing.standardProof}</p>
                  </div>
                )}

                <div className={`mt-6 border-t pt-6 ${featured ? "border-primary-foreground/15" : "border-border"}`}>
                  <p className="text-sm font-semibold">{t.pricing.included}</p>
                  <ul className="mt-4 space-y-3">{plan.benefits.map((benefit) => <PlanCheck key={benefit} featured={featured}>{benefit}</PlanCheck>)}</ul>
                </div>

                <div className="mt-auto pt-7">
                  <Link href="/register" className={`group flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${featured ? "border-brand bg-brand text-white hover:bg-brand/90" : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-muted"}`}>
                    {cta}<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                  <p className={`mt-3 text-center text-xs ${featured ? "text-primary-foreground/45" : "text-muted-foreground"}`}>{free ? t.pricing.noCard : t.pricing.cancelAnytime}</p>
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
