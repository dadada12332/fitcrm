"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const, delay },
})

export function CtaBand() {
  const t = useT()
  return (
    <section className="py-20 md:py-28" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1280px] px-6">
        <motion.div {...fadeUp(0)}
          className="relative overflow-hidden rounded-[32px] px-8 py-16 md:px-16 md:py-24 text-center"
          style={{ background: "#0e1117", boxShadow: "0 40px 110px -35px rgba(0,0,0,0.55)" }}>

          {/* Blue glow сверху */}
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 55% 55% at 50% 0%, rgba(0,101,252,0.38), transparent 62%)" }} />
          {/* Тонкая сетка */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 70% 80% at 50% 0%, #000, transparent 75%)" }} />

          <div className="relative">
            <motion.div {...fadeUp(0.05)} className="font-mono text-[12.5px] tracking-[0.12em] mb-5" style={{ color: "#7cb2ff" }}>
              {t.cta.eyebrow}
            </motion.div>
            <motion.h2 {...fadeUp(0.1)}
              className="text-[38px] md:text-[54px] font-semibold leading-[1.04] tracking-[-1.6px] text-white max-w-[720px] mx-auto">
              {t.cta.title1}<br className="hidden md:block" /> {t.cta.title2}
            </motion.h2>
            <motion.p {...fadeUp(0.16)}
              className="mt-5 text-[16px] md:text-[17px] leading-[26px] max-w-[560px] mx-auto" style={{ color: "#a1a1aa" }}>
              {t.cta.subtitle}
            </motion.p>

            <motion.div {...fadeUp(0.22)} className="flex flex-wrap items-center justify-center gap-3 pt-9">
              <Link href="/register"
                className="group h-12 flex items-center gap-2 px-6 rounded-full text-[15px] font-semibold transition-all hover:opacity-90"
                style={{ background: "#ffffff", color: "#0a0a0a" }}>
                {t.cta.ctaPrimary}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/login"
                className="h-12 flex items-center px-6 rounded-full text-[15px] font-semibold text-white transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}>
                {t.cta.ctaSecondary}
              </Link>
            </motion.div>

            <motion.p {...fadeUp(0.28)} className="mt-6 text-[13px]" style={{ color: "#71717a" }}>
              {t.cta.reassurance}
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
