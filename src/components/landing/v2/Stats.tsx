"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CalendarClock,
  FileText,
  Package,
} from "lucide-react"
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion"
import { useT } from "@/lib/i18n/context"

type Shot = { src: string; labelKey?: "table" | "pos" }

const TAB_META: { icon: typeof FileText; imgs: Shot[] }[] = [
  { icon: FileText, imgs: [{ src: "/screens/hero-reports.png" }] },
  {
    icon: Package,
    imgs: [
      { src: "/screens/hero-warehouse.png", labelKey: "table" },
      { src: "/screens/hero-warehouse-pos.png", labelKey: "pos" },
    ],
  },
  { icon: CalendarClock, imgs: [{ src: "/screens/hero-schedule.png" }] },
  { icon: Activity, imgs: [{ src: "/screens/hero-visits.png" }] },
]

const TAB_CYCLE_MS = 5600
const SHOT_CYCLE_MS = 2800
const ease = [0.22, 1, 0.36, 1] as const

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease, delay },
})

export function Stats() {
  const t = useT()
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { margin: "-25% 0px -25% 0px" })
  const reduceMotion = useReducedMotion()
  const tabs = TAB_META.map((meta, index) => ({
    ...meta,
    title: t.stats.tabs[index].t,
    desc: t.stats.tabs[index].d,
  }))

  const [active, setActive] = useState(0)
  const [sub, setSub] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || !inView || reduceMotion) return
    const timeout = window.setTimeout(() => {
      setSub(0)
      setActive((current) => (current + 1) % tabs.length)
    }, TAB_CYCLE_MS)
    return () => window.clearTimeout(timeout)
  }, [active, inView, paused, reduceMotion, tabs.length])

  useEffect(() => {
    if (paused || !inView || reduceMotion || TAB_META[active].imgs.length < 2) return
    const interval = window.setInterval(
      () => setSub((current) => (current + 1) % TAB_META[active].imgs.length),
      SHOT_CYCLE_MS,
    )
    return () => window.clearInterval(interval)
  }, [active, inView, paused, reduceMotion])

  const selectTab = (index: number) => {
    setActive(index)
    setSub(0)
  }

  const moveTabFocus = (index: number) => {
    selectTab(index)
    window.requestAnimationFrame(() => {
      document.getElementById(`platform-tab-${index}`)?.focus()
    })
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    moveTabFocus(nextIndex)
  }

  const shot = TAB_META[active].imgs[Math.min(sub, TAB_META[active].imgs.length - 1)]
  const shotLabel =
    shot.labelKey === "table"
      ? t.stats.tableLabel
      : shot.labelKey === "pos"
        ? t.stats.posLabel
        : null

  return (
    <section ref={sectionRef} className="bg-card py-20 md:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <motion.div
          {...fadeUp()}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/[0.06] sm:rounded-3xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setPaused(false)
            }
          }}
        >
          <div className="border-b border-border bg-muted/45 px-6 pb-8 pt-8 sm:px-12 sm:pb-10 sm:pt-10">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.12, ease }}
              className="mb-4 font-mono text-xs font-medium tracking-[0.08em] text-brand"
            >
              {t.stats.eyebrow}
            </motion.div>
            <h2 className="max-w-[640px] text-[36px] font-semibold leading-[1.06] text-foreground sm:text-[42px] md:text-[48px]">
              {t.stats.title1}
              <br />
              {t.stats.title2}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div
              role="tablist"
              aria-label={t.stats.eyebrow}
              className="border-border lg:border-r"
            >
              {tabs.map((tab, index) => {
                const Icon = tab.icon
                const selected = active === index

                return (
                  <button
                    key={tab.title}
                    id={`platform-tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="platform-preview"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(index)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className="group relative flex w-full items-start gap-4 border-b border-border px-5 py-5 text-left outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-10"
                  >
                    {selected && (
                      <>
                        <motion.span
                          layoutId="platform-tab-background"
                          className="absolute inset-0 bg-card"
                          transition={{ duration: 0.42, ease }}
                        />
                        <motion.span
                          layoutId="platform-tab-rail"
                          className="absolute inset-y-0 left-0 w-0.5 bg-brand"
                          transition={{ duration: 0.42, ease }}
                        />
                      </>
                    )}

                    <span
                      className={`relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
                        selected
                          ? "border-brand/25 bg-brand/10 text-brand"
                          : "border-border bg-muted text-foreground group-hover:bg-accent"
                      }`}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>

                    <span className="relative min-w-0 flex-1">
                      <span
                        className={`block font-mono text-sm font-medium tracking-[0.04em] transition-colors duration-300 ${
                          selected ? "text-brand" : "text-foreground"
                        }`}
                      >
                        {tab.title}
                      </span>
                      <span className="mt-1.5 block max-w-[390px] text-[13.5px] leading-5 text-muted-foreground">
                        {tab.desc}
                      </span>
                    </span>

                    {selected && !reduceMotion && (
                      <span className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-border">
                        <motion.span
                          key={`${active}-${paused}-${inView}`}
                          className="block h-full origin-left bg-brand"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: paused || !inView ? 0 : 1 }}
                          transition={{
                            duration: paused || !inView ? 0.2 : TAB_CYCLE_MS / 1000,
                            ease: "linear",
                          }}
                        />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div
              id="platform-preview"
              role="tabpanel"
              aria-labelledby={`platform-tab-${active}`}
              className="relative min-h-[300px] overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_12%,var(--card)),var(--muted))] sm:min-h-[410px] lg:min-h-[560px]"
            >
              <div className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-brand/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-card/60 blur-3xl" />

              <AnimatePresence mode="wait">
                {shotLabel && (
                  <motion.div
                    key={shotLabel}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease }}
                    className="absolute right-4 top-4 z-20 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] text-foreground shadow-sm backdrop-blur-md sm:right-5 sm:top-5"
                  >
                    {tabs[1].title} · {shotLabel.toUpperCase()}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${active}-${sub}`}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.975, x: 24, y: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, x: -14 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.55, ease }}
                  className="absolute left-5 top-7 w-[138%] max-w-[850px] sm:left-8 sm:top-10 sm:w-[130%] lg:top-12"
                >
                  <motion.div
                    animate={reduceMotion || paused ? undefined : { y: [0, -3, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-xl border border-card/70 bg-card/65 p-1.5 shadow-2xl shadow-foreground/15 backdrop-blur-xl sm:rounded-2xl sm:p-2"
                  >
                    <div className="flex gap-1.5 px-2 py-1.5 sm:py-2">
                      <span className="size-2 rounded-full bg-muted-foreground/30" />
                      <span className="size-2 rounded-full bg-muted-foreground/30" />
                      <span className="size-2 rounded-full bg-muted-foreground/30" />
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
                      <Image
                        src={shot.src}
                        alt={tabs[active].title}
                        width={3840}
                        height={2224}
                        sizes="(max-width: 1024px) 130vw, 720px"
                        className="block h-auto w-full align-top"
                        priority={active === 0}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-muted/80 to-transparent" />
            </div>
          </div>

          <Link
            href="/register"
            className="group flex items-center justify-center gap-2 border-t border-border bg-muted/45 px-4 py-6 font-mono text-[12px] font-medium tracking-[0.06em] text-brand outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:text-[13px]"
          >
            {t.stats.cta}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
