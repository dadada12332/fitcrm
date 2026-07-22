"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundX,
  WalletCards,
} from "lucide-react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion"
import { useT } from "@/lib/i18n/context"

const ease = [0.22, 1, 0.36, 1] as const
const SIGNAL_ICONS = [CalendarClock, UserRoundX, WalletCards]
const SIGNAL_TONES = [
  "bg-destructive/10 text-destructive",
  "bg-chart-3/10 text-chart-3",
  "bg-chart-1/10 text-chart-1",
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease, delay },
})

export function GrowthRetention() {
  const t = useT().growthRetention
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { margin: "-20% 0px -20% 0px" })
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!inView || paused || reduceMotion) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % t.signals.length), 3600)
    return () => window.clearInterval(timer)
  }, [inView, paused, reduceMotion, t.signals.length])

  const signal = t.signals[active]

  return (
    <section ref={sectionRef} id="growth-os" className="bg-muted/35 py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="mb-12 grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_440px] md:gap-12">
          <motion.div {...fadeUp()}>
            <p className="font-mono text-xs font-medium tracking-normal text-brand">{t.eyebrow}</p>
            <h2 className="mt-4 max-w-[720px] text-[38px] font-semibold leading-[1.06] tracking-normal text-foreground sm:text-[46px] md:text-[52px]">
              {t.title1} <span className="text-muted-foreground">{t.title2}</span>
            </h2>
          </motion.div>
          <motion.div {...fadeUp(0.08)}>
            <p className="text-[16px] leading-6 tracking-normal text-muted-foreground">{t.subtitle}</p>
            <Link
              href="/register"
              className="group mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.cta}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        <motion.div
          {...fadeUp(0.12)}
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/[0.06]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
          }}
        >
          <div className="grid lg:grid-cols-2">
            <div className="bg-card p-5 sm:p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <Activity className="size-4" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">{t.retentionTitle}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Beta</span>
                  </div>
                  <p className="mt-2 max-w-[440px] text-sm leading-5 text-muted-foreground">{t.retentionDesc}</p>
                </div>
                <span className="hidden rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive sm:inline-flex">
                  {t.riskBadge}
                </span>
              </div>

              <div role="tablist" aria-label={t.retentionTitle} className="mt-8 divide-y divide-border border-y border-border">
                {t.signals.map((item, index) => {
                  const Icon = SIGNAL_ICONS[index]
                  const selected = active === index
                  return (
                    <button
                      key={item.title}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActive(index)}
                      className={`group relative flex min-h-20 w-full items-center gap-3 px-1 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-brand/[0.04]" : "hover:bg-muted/50"}`}
                    >
                      {selected && (
                        <motion.span layoutId="retention-signal-rail" className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-brand" transition={{ duration: 0.4, ease }} />
                      )}
                      <span className={`ml-3 flex size-9 shrink-0 items-center justify-center rounded-lg ${SIGNAL_TONES[index]}`}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${selected ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>
                        {item.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/60 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-brand">{t.aiLabel}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={active}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                      transition={{ duration: 0.28, ease }}
                      className="mt-1 text-sm leading-5 text-foreground"
                    >
                      {signal.insight}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-primary p-5 text-primary-foreground sm:p-8 lg:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(color-mix(in_srgb,var(--primary-foreground)_35%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--primary-foreground)_35%,transparent)_1px,transparent_1px)] [background-size:48px_48px]" />
              <div className="relative flex h-full min-h-[490px] flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground">
                        <TrendingUp className="size-4" />
                      </span>
                      <p className="text-sm font-semibold">Growth OS</p>
                      <span className="rounded bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground/70">Lab</span>
                    </div>
                    <p className="mt-2 max-w-[420px] text-sm leading-5 text-primary-foreground/60">{t.growthDesc}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[10px] font-medium uppercase text-primary-foreground/50">{t.pulseLabel}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">82 / 100</p>
                  </div>
                </div>

                <div className="mt-9 flex items-center gap-3 border-y border-primary-foreground/15 py-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary-foreground/20">
                    <Gauge className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-primary-foreground/55">{t.todayPlan}</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={active}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                        transition={{ duration: 0.32, ease }}
                        className="mt-1 text-base font-semibold"
                      >
                        {signal.action}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <span className="rounded-md bg-primary-foreground px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">{signal.count}</span>
                </div>

                <div className="mt-7 space-y-4">
                  {t.steps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${index <= 1 ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-primary-foreground/15 text-primary-foreground/45"}`}>
                        {index <= 1 ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <span className={`text-sm ${index <= 1 ? "text-primary-foreground/85" : "text-primary-foreground/45"}`}>{step}</span>
                      {index === 1 && !reduceMotion && (
                        <motion.span className="ml-auto size-1.5 rounded-full bg-chart-2" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8">
                  <div className="flex items-start gap-3 border-t border-primary-foreground/15 pt-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                      <Target className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary-foreground/50">{t.expectedResult}</p>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={active}
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                          transition={{ duration: 0.3, ease }}
                          className="mt-1 text-lg font-semibold"
                        >
                          {signal.result}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <ArrowRight className="mt-2 size-4 text-primary-foreground/45" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {t.benefits.map((benefit, index) => {
            const Icon = [Activity, Sparkles, Target][index]
            return (
              <motion.div key={benefit.title} {...fadeUp(0.14 + index * 0.06)} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{benefit.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
