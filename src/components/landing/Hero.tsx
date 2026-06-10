"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { motion, animate, useInView } from "framer-motion"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { MockDashboard } from "./MockDashboard"

const featureTags = ["Интеграции", "Отчёты", "QR-чекин", "Уведомления", "Безопасность", "Аналитика"]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

const hoverLift = { y: -6, transition: { duration: 0.25, ease: "easeOut" as const } }

/* Animated number counter that runs once when scrolled into view */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, to])

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  )
}

export function Hero() {
  return (
    <section className="pt-28 pb-12 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-[minmax(0,auto)]">
        {/* Big cream hero card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          whileHover={hoverLift}
          className="relative overflow-hidden lg:col-span-2 rounded-3xl p-8 md:p-12 flex flex-col justify-between min-h-[420px]"
          style={{ background: "#ffffff", color: "#0a0a0a" }}
        >
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8"
              style={{ background: "rgba(10,10,10,0.06)", color: "#0a0a0a", fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--orange)" }} />
              Множество решений
            </span>
            <h1
              className="leading-[1.04] mb-5"
              style={{ fontSize: "clamp(40px, 6vw, 76px)", color: "#0a0a0a" }}
            >
              Управляй клубом
              <br />
              <span style={{ color: "var(--orange)" }}>проще</span> и быстрее
            </h1>
            <p className="max-w-md text-base md:text-lg leading-relaxed" style={{ color: "rgba(10,10,10,0.6)" }}>
              Клиенты, абонементы, QR-чекин, расписание и Telegram-бот —
              всё в одной системе для вашего фитнес-клуба.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-4 mt-8">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ background: "#0a0a0a", fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.03em" }}
            >
              Начать с FitCRM
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Dark mockup card */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          whileHover={hoverLift}
          className="rounded-3xl p-4 min-h-[420px]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <MockDashboard />
        </motion.div>

        {/* Blue accent card */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          whileHover={hoverLift}
          className="rounded-3xl p-7 flex flex-col justify-between min-h-[200px] relative overflow-hidden"
          style={{ background: "var(--orange)", color: "#fff" }}
        >
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex -space-x-2">
              {["#fbbf24", "#f472b6", "#34d399"].map((c) => (
                <div key={c} className="w-8 h-8 rounded-full border-2" style={{ background: c, borderColor: "var(--orange)" }} />
              ))}
            </div>
            <span className="text-xs font-medium opacity-80 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
              Свежие обновления
            </span>
          </div>
          <h3 className="relative z-10 leading-tight" style={{ fontSize: "clamp(22px, 2.5vw, 30px)", color: "#fff" }}>
            Расширенные<br />возможности доступны
          </h3>
        </motion.div>

        {/* Stats card */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          whileHover={hoverLift}
          className="lg:col-span-2 rounded-3xl p-7 md:p-8 flex flex-col sm:flex-row gap-8 items-center min-h-[200px]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex-shrink-0 text-center sm:text-left">
            <div className="leading-none" style={{ fontSize: "clamp(52px, 7vw, 84px)", color: "var(--on-dark)", fontFamily: "var(--font-display)" }}>
              <CountUp to={89} suffix="%" />
            </div>
            <p className="text-sm mt-2 max-w-[180px]" style={{ color: "var(--on-dark-soft)" }}>
              клубов повысили эффективность с FitCRM
            </p>
          </div>
          <div className="flex flex-wrap gap-2 content-center">
            {featureTags.map((t) => (
              <span
                key={t}
                className="px-4 py-2 rounded-full text-xs font-medium"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
