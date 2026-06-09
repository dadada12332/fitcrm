"use client"

import Link from "next/link"
import { motion } from "framer-motion"

/* ─── Dashboard mockup inside glass card ─── */
function DashboardMockup() {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.22)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow: "0 24px 64px rgba(14,101,173,0.18), 0 2px 8px rgba(255,255,255,0.5) inset",
      }}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30"
        style={{ background: "rgba(255,255,255,0.35)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70"/>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70"/>
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/70"/>
        </div>
        <div className="flex-1 mx-4 h-6 rounded-md flex items-center px-3"
          style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.6)" }}>
          <span className="text-xs" style={{ color: "var(--muted)" }}>fitcrm.uz/dashboard</span>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex" style={{ minHeight: "340px" }}>
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 p-4 flex flex-col gap-1 border-r border-white/20"
          style={{ background: "rgba(255,255,255,0.15)" }}>
          <p className="text-xs font-bold mb-3 px-2" style={{ color: "var(--ink)" }}>FitCRM</p>
          {["Дашборд", "Клиенты", "Абонементы", "Расписание", "Аналитика", "Настройки"].map((item, i) => (
            <div key={item} className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{
                background: i === 1 ? "rgba(255,255,255,0.6)" : "transparent",
                color: i === 1 ? "var(--ink)" : "var(--ink-soft)",
              }}>
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Клиентов", value: "312", up: true, delta: "+12%" },
              { label: "Посещений", value: "1 842", up: true, delta: "+8%" },
              { label: "Выручка", value: "4.2M", up: false, delta: "-2%" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.6)",
                }}>
                <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
                <p className="text-lg font-bold leading-none mb-1" style={{ color: "var(--ink)" }}>{s.value}</p>
                <span className="text-[10px] font-medium"
                  style={{ color: s.up ? "#16a34a" : "#dc2626" }}>
                  {s.delta}
                </span>
              </div>
            ))}
          </div>

          {/* Client list */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.6)" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/40">
              <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Клиенты</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--sky-top)", color: "white" }}>Активные</span>
            </div>
            {[
              { name: "Алишер Каримов", plan: "Standard", status: "Активен", ok: true },
              { name: "Нилуфар Юсупова", plan: "Business", status: "Активен", ok: true },
              { name: "Санжар Рашидов", plan: "Starter", status: "Истекает", ok: false },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/20 last:border-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--sky-top), #3b82f6)" }}>
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>{c.plan}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: c.ok ? "rgba(22,163,74,0.1)" : "rgba(251,146,60,0.15)",
                    color: c.ok ? "#16a34a" : "#ea580c",
                  }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Hero ─── */
export function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #7ec8e3 0%, #b3dff5 18%, #d6eefa 42%, #eaf6fd 65%, #f5fbff 100%)",
        paddingTop: "64px",
      }}
    >
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-16 pb-12 flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{
              background: "rgba(255,255,255,0.35)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.5)",
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
            CRM для фитнес-клубов · Узбекистан
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="font-black leading-[1.02] tracking-tight mb-6 max-w-3xl"
          style={{
            fontSize: "clamp(42px, 6.5vw, 76px)",
            letterSpacing: "-2px",
            color: "var(--ink)",
          }}
        >
          Управляй клубом.<br />
          <span style={{ color: "#0ea5e9" }}>Расти быстрее.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="text-lg max-w-lg mb-10 leading-relaxed"
          style={{ color: "var(--ink-soft)" }}
        >
          Клиенты, абонементы, QR-чекин и Telegram-бот в одной системе.
          Всё что нужно современному фитнес-клубу.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-5"
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--cta-dark)", color: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--cta-dark-hover)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--cta-dark)")}
          >
            Начать бесплатно →
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold transition-colors"
            style={{
              background: "rgba(255,255,255,0.35)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.55)",
              color: "var(--ink)",
            }}
          >
            Смотреть демо
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center gap-3 mb-14"
        >
          <div className="flex -space-x-2">
            {["А", "Б", "В", "Г", "Д"].map((l) => (
              <div key={l}
                className="w-8 h-8 rounded-full border-2 border-white/70 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--sky-top), #3b82f6)" }}
              >
                {l}
              </div>
            ))}
          </div>
          <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Рейтинг <strong style={{ color: "var(--ink)" }}>4.8/5</strong> от 50+ клубов
          </span>
        </motion.div>

        {/* Floating dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  )
}
