"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Package, CalendarClock, Activity, ArrowRight } from "lucide-react"
import { useT } from "@/lib/i18n/context"

type Shot = { src: string; labelKey?: "table" | "pos" }
const TAB_META: { icon: typeof FileText; imgs: Shot[] }[] = [
  { icon: FileText,      imgs: [{ src: "/screens/hero-reports.png" }] },
  { icon: Package,       imgs: [{ src: "/screens/hero-warehouse.png", labelKey: "table" }, { src: "/screens/hero-warehouse-pos.png", labelKey: "pos" }] },
  { icon: CalendarClock, imgs: [{ src: "/screens/hero-schedule.png" }] },
  { icon: Activity,      imgs: [{ src: "/screens/hero-visits.png" }] },
]
const CYCLE = 5200
const SUB_CYCLE = 2500

const fade = (d = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: "easeOut" as const, delay: d } })

export function Stats() {
  const t = useT()
  const TABS = TAB_META.map((m, i) => ({ ...m, title: t.stats.tabs[i].t, desc: t.stats.tabs[i].d }))
  const [active, setActive] = useState(0)
  const [sub, setSub] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const iv = setInterval(() => setActive((a) => (a + 1) % TABS.length), CYCLE)
    return () => clearInterval(iv)
  }, [paused, TABS.length])

  useEffect(() => { setSub(0) }, [active])
  useEffect(() => {
    if (paused || TAB_META[active].imgs.length < 2) return
    const iv = setInterval(() => setSub((s) => (s + 1) % TAB_META[active].imgs.length), SUB_CYCLE)
    return () => clearInterval(iv)
  }, [active, paused])

  const shot = TAB_META[active].imgs[Math.min(sub, TAB_META[active].imgs.length - 1)]
  const shotLabel = shot.labelKey === "table" ? t.stats.tableLabel : shot.labelKey === "pos" ? t.stats.posLabel : null

  return (
    <section className="py-20 md:py-28" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <motion.div {...fade(0)} className="rounded-[24px] overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.1)" }}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {/* Header */}
          <div className="px-8 sm:px-12 pt-10 pb-9" style={{ background: "#f8f9fa", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
            <div className="font-mono text-[12.5px] tracking-[0.08em] mb-4" style={{ color: "#0065fc" }}>{t.stats.eyebrow}</div>
            <h2 className="text-[38px] md:text-[48px] font-semibold leading-[1.05] tracking-[-1.2px] text-[#0a0a0a] max-w-[640px]">
              {t.stats.title1}<br />{t.stats.title2}
            </h2>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Левый список — кликабельные табы */}
            <div style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>
              {TABS.map((tab, i) => {
                const Icon = tab.icon
                const on = active === i
                return (
                  <button key={i} onClick={() => setActive(i)}
                    className="w-full text-left flex items-start gap-4 px-7 sm:px-10 py-5 transition-colors"
                    style={{
                      borderBottom: i < TABS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                      borderLeft: `2px solid ${on ? "#0065fc" : "transparent"}`,
                      background: on ? "#ffffff" : "transparent",
                    }}>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                      style={{ background: on ? "rgba(0,101,252,0.1)" : "#f4f5f7", border: `1px solid ${on ? "rgba(0,101,252,0.25)" : "rgba(0,0,0,0.06)"}` }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color: on ? "#0065fc" : "#27272a" }} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1">
                      <div className="font-mono text-[14px] tracking-[0.04em]" style={{ color: on ? "#0065fc" : "#0a0a0a" }}>{tab.title}</div>
                      <p className="text-[13.5px] leading-[20px] mt-1.5 max-w-[380px]" style={{ color: on ? "#3f3f46" : "#52525b" }}>{tab.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Правый визуал */}
            <div className="relative overflow-hidden min-h-[320px] lg:min-h-[560px]"
              style={{ background: "linear-gradient(135deg, #e9f0ff 0%, #f4f6fb 55%, #eef1f6 100%)" }}>
              <div className="pointer-events-none absolute rounded-full blur-[60px]" style={{ background: "rgba(0,101,252,0.12)", inset: "-20% 30% 60% -10%" }} />

              {shotLabel && (
                <div className="absolute top-5 right-5 z-10 font-mono text-[11px] tracking-[0.06em] px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,0,0,0.07)", color: "#0a0a0a" }}>
                  {TABS[1].title} · {shotLabel.toUpperCase()}
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div key={`${active}-${sub}`} initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute left-8 top-9 lg:top-12 w-[130%] max-w-[820px]" style={{ transform: "translateZ(0)" }}>
                  <div className="rounded-[14px] p-2 border" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(18px)", borderColor: "rgba(255,255,255,0.7)", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.28)" }}>
                    <div className="flex gap-1.5 px-2 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-300" /><span className="w-2 h-2 rounded-full bg-neutral-300" /><span className="w-2 h-2 rounded-full bg-neutral-300" />
                    </div>
                    <div className="rounded-[9px] overflow-hidden border" style={{ borderColor: "rgba(0,0,0,0.06)", transform: "translateZ(0)" }}>
                      <Image src={shot.src} alt={TABS[active].title} width={3840} height={2224} className="w-full h-auto block align-top" style={{ borderRadius: 9 }} priority={active === 0} />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer CTA */}
          <Link href="/register" className="group flex items-center justify-center gap-2 py-6 font-mono text-[13px] tracking-[0.06em] transition-colors"
            style={{ background: "#f8f9fa", borderTop: "1px solid rgba(0,0,0,0.08)", color: "#0065fc" }}>
            {t.stats.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
