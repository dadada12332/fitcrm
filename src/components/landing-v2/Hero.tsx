"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.7, delay: 0.05 + i * 0.1, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export function Hero() {
  return (
    <section className="pt-36 pb-14 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="flex justify-center">
          <Link href="#work" className="v2-chip inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full text-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-zinc-700">Telegram-бот ускоряет продления на ~23%</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          </Link>
        </motion.div>

        <motion.h1
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="mt-7 font-bold text-zinc-900 mx-auto"
          style={{ fontSize: "clamp(40px, 6vw, 76px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}
        >
          Управляйте клубом<br />как топовый SaaS
        </motion.h1>

        <motion.p
          custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="mt-6 v2-muted mx-auto max-w-xl leading-relaxed"
          style={{ fontSize: "clamp(15px, 1.5vw, 18px)" }}
        >
          FitCRM — система для фитнес-клубов Узбекистана: клиенты, абонементы, оплаты,
          расписание и Telegram-бот в одном продукте уровня Stripe и Linear.
        </motion.p>

        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="show"
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/register" className="v2-btn-primary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Начать бесплатно
          </Link>
          <Link href="#work" className="v2-btn-secondary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Смотреть экраны
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
