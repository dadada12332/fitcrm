"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export function CtaBand() {
  return (
    <section className="py-6 px-6" style={{ background: "#eaf6fd" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65 }}
          className="rounded-2xl px-12 py-16 relative overflow-hidden"
          style={{ background: "var(--cta-dark)" }}
        >
          {/* Subtle glow */}
          <div
            className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)",
              transform: "translate(30%, -30%)",
            }}
          />

          <div className="relative z-10 max-w-xl">
            <h2
              className="font-black tracking-tight mb-4 leading-tight"
              style={{
                fontSize: "clamp(26px, 3vw, 38px)",
                letterSpacing: "-1px",
                color: "#fff",
              }}
            >
              Начните управлять клубом умнее уже сегодня
            </h2>
            <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>
              14 дней бесплатно. Никаких договоров. Отмена в один клик.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center h-11 px-6 rounded-full text-sm font-semibold transition-colors"
                style={{ background: "#fff", color: "var(--cta-dark)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                Попробовать бесплатно →
              </Link>
              <Link
                href="#faq"
                className="inline-flex items-center h-11 px-6 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                Частые вопросы
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
