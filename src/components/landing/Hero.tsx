"use client"

import Link from "next/link"
import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { MockDashboard } from "./MockDashboard"

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, delay: 0.05 + i * 0.12, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export function Hero() {
  const dashRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: dashRef,
    offset: ["start 0.85", "start 0.15"],
  })
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0])

  return (
    <section className="relative pt-36 pb-16 px-4 overflow-hidden">
      <div className="hero-spotlight" />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        {/* Badge */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="flex justify-center">
          <Link href="#capabilities" className="inline-flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-full text-xs sol-chip transition-transform hover:scale-[1.03]">
            <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-medium" style={{ background: "var(--accent-strong)" }}>
              Новое
            </span>
            <span className="text-white/70">Telegram-бот и QR-чекин</span>
            <ArrowRight className="w-3.5 h-3.5 text-white/50" />
          </Link>
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-7 text-center mx-auto max-w-4xl font-semibold text-white"
          style={{ fontSize: "clamp(38px, 5.6vw, 72px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          Ваша <span className="text-accent">CRM для фитнеса,</span>
          <br />готовая к работе.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 text-center mx-auto max-w-2xl text-white/55 leading-relaxed"
          style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
        >
          Хватит вести клуб в тетрадях и Excel. FitCRM объединяет клиентов, абонементы,
          оплаты, расписание и Telegram-бота — в одной системе, которая растёт вместе с вами.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/register" className="btn-primary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Начать бесплатно
          </Link>
          <Link href="#usecases" className="btn-secondary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Смотреть демо
          </Link>
        </motion.div>

        {/* Dashboard mockup — крупный, «выезжает из-за экрана» */}
        <div ref={dashRef} className="mt-12 md:mt-16" style={{ perspective: 2200 }}>
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[1360px]"
            style={{
              WebkitMaskImage: "linear-gradient(180deg, #000 80%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 80%, transparent 100%)",
            }}
          >
            <motion.div style={{ rotateX, transformOrigin: "center 12%" }}>
              <div
                className="rounded-2xl p-1.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 60px 160px -40px rgba(37,99,235,0.45)" }}
              >
                <div className="h-[620px] md:h-[780px]">
                  <MockDashboard />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
