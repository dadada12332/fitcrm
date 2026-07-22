"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
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
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay },
})

function CheckItem({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center shrink-0"
        style={dark ? { background: "#ffffff" } : { background: "#f0f1f3", border: "1px solid rgba(0,0,0,0.05)" }}>
        <Check className="w-3.5 h-3.5" style={{ color: "#0a0a0a" }} strokeWidth={3} />
      </span>
      <span className="text-[14px]" style={{ color: dark ? "#d4d4d8" : "#3f3f46" }}>{children}</span>
    </li>
  )
}

export function PricingCards({ plans }: { plans: LandingPlan[] }) {
  const t = useT()
  const [billing, setBilling] = useState<"month" | "year">("year")
  const paid = plans.filter((p) => !p.isTrial)
  const popularCode =
    plans.find((p) => p.popular)?.code ??
    [...paid].sort((a, b) => b.price - a.price)[0]?.code
  const colClass = plans.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"

  return (
    <section id="pricing" className="relative py-24 md:py-32" style={{ background: "#ffffff" }}>
      <div className="relative mx-auto max-w-[1840px] px-8">
        {/* Heading */}
        <div className="max-w-[720px] mx-auto text-center mb-10">
          <motion.h2 {...fadeUp(0)} className="text-[40px] md:text-[52px] font-normal leading-[1.05] tracking-[-1.4px] text-[#0a0a0a]">
            {t.pricing.title}
          </motion.h2>
          <motion.p {...fadeUp(0.08)} className="text-[17px] leading-[26px] text-[#52525b] mt-4">
            {t.pricing.subtitle}
          </motion.p>
        </div>

        {/* Inline check badges */}
        <motion.div {...fadeUp(0.14)} className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-8">
          {t.pricing.badges.map((b) => (
            <div key={b} className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#0a0a0a" }}>
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </span>
              <span className="text-[15px] font-medium text-[#0a0a0a]">{b}</span>
            </div>
          ))}
        </motion.div>

        {/* Billing toggle */}
        <motion.div {...fadeUp(0.18)} className="flex justify-center mb-16">
          <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.08)" }}>
            <button onClick={() => setBilling("month")}
              className="px-6 h-11 rounded-full text-[14.5px] font-medium transition-all"
              style={billing === "month" ? { background: "#0a0a0a", color: "#ffffff", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.3)" } : { color: "#52525b" }}>
              {t.pricing.monthly}
            </button>
            <button onClick={() => setBilling("year")}
              className="px-6 h-11 rounded-full text-[14.5px] font-medium transition-all flex items-center gap-2"
              style={billing === "year" ? { background: "#0a0a0a", color: "#ffffff", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.3)" } : { color: "#52525b" }}>
              {t.pricing.yearly}
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={billing === "year" ? { background: "#0065fc", color: "#ffffff" } : { background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>
                {t.pricing.off}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${colClass} gap-6 items-stretch`}>
          {plans.map((p, i) => {
            const dark = p.code === popularCode
            const free = p.isTrial || p.price === 0
            const shown = billing === "year" ? Math.round(p.price * (1 - YEAR_DISCOUNT)) : p.price
            const shownOld = p.oldPrice && p.oldPrice > p.price
              ? billing === "year" ? Math.round(p.oldPrice * (1 - YEAR_DISCOUNT)) : p.oldPrice
              : null
            const annualTotal = shown * 12
            return (
              <motion.div key={p.code} {...fadeUp(0.16 + i * 0.06)}
                className="relative rounded-[24px] p-8 flex flex-col overflow-hidden"
                style={dark
                  ? { background: "#0e1117", border: "1px solid #0e1117", boxShadow: "0 30px 70px -30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" }
                  : { background: "#ffffff", border: "1px solid rgba(0,0,0,0.09)" }}>

                {/* Угловая лента "Популярно" */}
                {dark && (
                  <div className="absolute top-0 right-0 w-[130px] h-[130px] overflow-hidden pointer-events-none">
                    <div className="absolute rotate-45 flex items-center justify-center text-[11px] font-bold text-white tracking-wide"
                      style={{ background: "#0065fc", top: 26, right: -38, width: 160, height: 26 }}>
                      {t.pricing.popular}
                    </div>
                  </div>
                )}

                {/* Name */}
                <div className="text-[22px] font-semibold" style={{ color: dark ? "#ffffff" : "#0a0a0a" }}>{p.name}</div>

                {/* Price */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-5">
                  {free ? (
                    <span className="text-[38px] font-semibold leading-none tracking-[-1.2px]" style={{ color: dark ? "#ffffff" : "#0a0a0a" }}>{t.pricing.free}</span>
                  ) : (
                    <>
                      {shownOld !== null && (
                        <span
                          className="text-[18px] leading-none line-through"
                          style={{ color: dark ? "#71717a" : "#9ca3af" }}
                        >
                          {ru(shownOld)}
                        </span>
                      )}
                      <span className="text-[38px] font-semibold leading-none tracking-[-1.2px]" style={{ color: dark ? "#ffffff" : "#0a0a0a" }}>{ru(shown)}</span>
                      <span className="text-[14px]" style={{ color: dark ? "#a1a1aa" : "#9ca3af" }}>{t.pricing.perMonth}</span>
                    </>
                  )}
                </div>

                {/* Sub-price */}
                <div className="h-5 flex items-center gap-2 mt-2">
                  {free ? (
                    <span className="text-[13px]" style={{ color: dark ? "#71717a" : "#9ca3af" }}>{t.pricing.trialDays(p.trialDays)}</span>
                  ) : billing === "year" ? (
                    <>
                      <span className="text-[13px]" style={{ color: dark ? "#a1a1aa" : "#52525b" }}>{t.pricing.perYear(ru(annualTotal))}</span>
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: dark ? "rgba(0,101,252,0.25)" : "rgba(22,163,74,0.12)", color: dark ? "#7cb2ff" : "#16a34a" }}>{t.pricing.save}</span>
                    </>
                  ) : (
                    <span className="text-[13px]" style={{ color: dark ? "#71717a" : "#9ca3af" }}>{t.pricing.noVat}</span>
                  )}
                </div>

                {/* Category label */}
                <div className="text-[15px] font-semibold mt-6 mb-4 pt-6" style={{ color: dark ? "#ffffff" : "#0a0a0a", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"}` }}>
                  {p.subtitle || t.pricing.included}
                </div>

                {/* Benefits */}
                <ul className="flex flex-col gap-2.5">
                  {p.benefits.map((b) => <CheckItem key={b} dark={dark}>{b}</CheckItem>)}
                </ul>

                {/* CTA — полноширинная кнопка */}
                <div className="mt-auto pt-7">
                  <Link href="/register"
                    className="flex items-center justify-center w-full h-12 rounded-[12px] text-[15px] font-semibold transition-all"
                    style={dark
                      ? { background: "#ffffff", color: "#0a0a0a" }
                      : { background: "#ffffff", color: "#0a0a0a", border: "1px solid rgba(0,0,0,0.16)" }}
                    onMouseEnter={(e) => { if (!dark) { e.currentTarget.style.background = "#0a0a0a"; e.currentTarget.style.color = "#ffffff" } else e.currentTarget.style.opacity = "0.9" }}
                    onMouseLeave={(e) => { if (!dark) { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.color = "#0a0a0a" } else e.currentTarget.style.opacity = "1" }}>
                    {p.cta}
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
