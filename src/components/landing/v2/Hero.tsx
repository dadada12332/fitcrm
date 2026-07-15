"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { useT } from "@/lib/i18n/context"

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: "easeOut" as const, delay },
})

const SLIDES = [
  { src: "/screens/hero-dashboard.png",    alt: "FitCRM — дашборд клуба" },
  { src: "/screens/hero-clients2.png",     alt: "FitCRM — база клиентов" },
  { src: "/screens/hero-memberships2.png", alt: "FitCRM — абонементы" },
]

function Frame({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="rounded-[18px] p-2.5"
      style={{
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(22px) saturate(1.6)",
        WebkitBackdropFilter: "blur(22px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.75)",
        transform: "translateZ(0)",
      }}>
      <div className="flex items-center px-2 py-[7px]">
        <div className="flex gap-1.5">
          <div className="w-[9px] h-[9px] rounded-full bg-neutral-300" />
          <div className="w-[9px] h-[9px] rounded-full bg-neutral-300" />
          <div className="w-[9px] h-[9px] rounded-full bg-neutral-300" />
        </div>
      </div>
      <div className="relative border border-black/[0.06] bg-white" style={{ borderRadius: 10, overflow: "hidden", transform: "translateZ(0)" }}>
        <Image src={src} alt={alt} width={3840} height={2230} priority={priority} className="w-full h-auto block align-top" style={{ borderRadius: 10 }} />
      </div>
    </div>
  )
}

function HeroCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = SLIDES.length

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive((a) => (a + 1) % n), 4200)
    return () => clearInterval(t)
  }, [paused, n])

  return (
    <div className="relative w-full max-w-[1400px] mx-auto mt-14"
      style={{ height: "clamp(340px, 50vw, 700px)", perspective: 2000 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {SLIDES.map((s, i) => {
        const rel = ((i - active) % n + n) % n           // 0 центр, 1 справа, 2 слева
        const isCenter = rel === 0
        const x = isCenter ? "0%" : rel === 1 ? "54%" : "-54%"
        const scale = isCenter ? 1 : 0.82
        const opacity = isCenter ? 1 : 0.5
        const blur = isCenter ? "blur(0px)" : "blur(1.5px)"
        const z = isCenter ? 30 : 10
        return (
          <div key={s.src} className="absolute top-1/2 left-1/2 w-[78%] max-w-[1000px] -translate-x-1/2 -translate-y-1/2"
            style={{ zIndex: z }}>
            <motion.div
              animate={{ x, scale, opacity, filter: blur }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className={isCenter ? "" : "cursor-pointer"}
              onClick={() => !isCenter && setActive(i)}>
              <Frame src={s.src} alt={s.alt} priority={i === 0} />
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

export function Hero() {
  const t = useT()
  return (
    <section className="relative overflow-hidden" style={{ background: "#ffffff" }}>
      {/* Реальные облака — фон Hero с плавным дрейфом */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 clouds-anim">
          <Image src="/screens/clouds.jpg" alt="" fill className="object-cover object-top" priority />
        </div>
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.62) 38%, rgba(255,255,255,0.9) 72%, #ffffff 100%)" }} />
      </div>

      <div className="relative flex flex-col items-center pt-48 pb-32 px-4">
        {/* Heading */}
        <motion.div {...fadeUp(0.08)} className="max-w-[672px] pt-6 text-center">
          <h1 className="font-bold text-center" style={{ fontSize: "clamp(42px, 6.5vw, 68px)", lineHeight: "1.05", letterSpacing: "-0.04em" }}>
            <span className="block text-[#0a0a0a]">{t.hero.title1}</span>
            <span className="block text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.02em" }}>
              {t.hero.title2}
            </span>
          </h1>
        </motion.div>

        {/* Subtext */}
        <motion.div {...fadeUp(0.14)} className="max-w-[690px] pt-4 text-center">
          <p className="text-[16px] font-normal leading-[24px] tracking-[-0.4px] text-[#52525b]">
            {t.hero.subtitle}
          </p>
        </motion.div>

        {/* CTA button */}
        <motion.div {...fadeUp(0.2)} className="pt-8">
          <Link href="/register" className="group inline-flex items-center rounded-full hover:scale-[1.02] transition-transform duration-200">
            <div className="relative z-10 flex items-center gap-4 rounded-full pl-7 pr-2 py-2"
              style={{
                background: "rgba(255,255,255,0.5)",
                backdropFilter: "blur(22px) saturate(1.8)",
                WebkitBackdropFilter: "blur(22px) saturate(1.8)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
              }}>
              <span className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.2px]">{t.hero.cta}</span>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#0a0a0a" }}>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Карусель мокапов */}
        <HeroCarousel />
      </div>
    </section>
  )
}
