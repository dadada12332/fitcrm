"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const testimonials = [
  {
    quote: "FitCRM полностью изменил то, как мы работаем. Продлений стало больше, а рутины меньше — команда наконец занимается клиентами, а не таблицами.",
    name: "Тимур Маткаримов",
    role: "Управляющий",
    club: "PowerGym Ташкент",
    color: "#fbbf24",
  },
  {
    quote: "QR-чекин и Telegram-бот сняли нагрузку с ресепшена. Клиенты сами проверяют баланс и записываются — это экономит нам часы каждый день.",
    name: "Дилноза Рахимова",
    role: "Владелица",
    club: "FitZone Самарканд",
    color: "#f472b6",
  },
  {
    quote: "Аналитика в реальном времени помогла поднять выручку на 23% за квартал. Я вижу всё: посещаемость, истекающие абонементы, конверсию.",
    name: "Азиз Каримов",
    role: "Директор сети",
    club: "IronHouse",
    color: "#34d399",
  },
]

export function Testimonials() {
  const [index, setIndex] = useState(0)
  const t = testimonials[index]

  return (
    <section className="relative py-28 px-4 overflow-hidden">
      <div className="grid-bg absolute inset-0" aria-hidden />

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl flex-shrink-0 p-[2px]" style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)" }}>
            <div className="w-full h-full rounded-[10px]" style={{ background: t.color }} />
          </div>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="text-white font-medium leading-snug"
              style={{ fontSize: "clamp(20px, 2.6vw, 32px)", letterSpacing: "-0.01em" }}
            >
              «{t.quote}»
            </motion.blockquote>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold text-white">{t.club}</span>
            <div className="leading-tight">
              <div className="text-sm text-white">{t.name}</div>
              <div className="text-xs text-white/45">{t.role}</div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: i === index ? "#fff" : "rgba(255,255,255,0.35)" }}>
                  0{i + 1}
                </span>
                {i === index && <span className="w-16 h-px" style={{ background: "rgba(255,255,255,0.6)" }} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
