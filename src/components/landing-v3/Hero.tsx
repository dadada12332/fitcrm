"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { MockDashboard } from "@/components/landing/MockDashboard"

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.7, delay: 0.05 + i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export function Hero() {
  return (
    <section id="product" className="relative pt-36 pb-16 px-4 overflow-hidden">
      <div className="v3-aurora" />
      <div className="v3-grid" />

      <div className="relative z-10 max-w-[1240px] mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        {/* Left: copy */}
        <div>
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
            <Link href="#features" className="v3-chip inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full text-xs">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
              <span className="text-white/70">Новое — Telegram-бот и QR-чекин</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/50" />
            </Link>
          </motion.div>

          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="show"
            className="mt-6 font-semibold text-white"
            style={{ fontSize: "clamp(38px, 5vw, 66px)", lineHeight: 1.04, letterSpacing: "-0.03em" }}
          >
            CRM для фитнеса,<br /><span className="v3-text-gradient">созданная для скорости</span>
          </motion.h1>

          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="mt-5 text-white/55 max-w-lg leading-relaxed"
            style={{ fontSize: "clamp(15px, 1.4vw, 17px)" }}
          >
            Клиенты, абонементы, оплаты, расписание и Telegram-бот — в одном продукте.
            Быстро, красиво и под ваш клуб.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="v3-btn inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">Начать бесплатно</Link>
            <Link href="#features" className="v3-btn-ghost inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">Смотреть демо</Link>
          </motion.div>
        </div>

        {/* Right: live dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateY: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ perspective: 1600 }}
        >
          <div className="v3-card rounded-2xl p-1.5" style={{ boxShadow: "0 50px 120px -40px rgba(124,58,237,0.5)" }}>
            <div className="h-[560px] md:h-[640px]">
              <MockDashboard />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
