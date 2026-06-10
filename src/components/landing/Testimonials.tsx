"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Quote } from "lucide-react"

const testimonials = [
  {
    quote:
      "Бесшовная интеграция и мощная автоматизация FitCRM полностью изменили то, как мы работаем. Команда в восторге — продлений стало больше, а рутины меньше.",
    name: "Тимур Маткаримов",
    role: "Управляющий, PowerGym Ташкент",
    color: "#fbbf24",
  },
  {
    quote:
      "QR-чекин и Telegram-бот сняли нагрузку с ресепшена. Клиенты сами проверяют баланс и записываются — это экономит часы каждый день.",
    name: "Дилноза Рахимова",
    role: "Владелица, FitZone Самарканд",
    color: "#f472b6",
  },
  {
    quote:
      "Аналитика в реальном времени помогла поднять выручку на 23% за квартал. Теперь я вижу всё: посещаемость, истекающие абонементы, конверсию.",
    name: "Азиз Каримов",
    role: "Директор сети, IronHouse",
    color: "#34d399",
  },
]

export function Testimonials() {
  const [index, setIndex] = useState(0)
  const t = testimonials[index]

  const prev = () => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length)
  const next = () => setIndex((i) => (i + 1) % testimonials.length)

  return (
    <section className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
            Любят клиенты
          </span>
          <h2 className="mt-4 mx-auto max-w-3xl" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 1 }}>
            Клиенты любят наш продукт
          </h2>
        </motion.div>

        <div
          className="rounded-3xl p-8 md:p-14 max-w-4xl mx-auto"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Quote className="w-10 h-10 mb-6" style={{ color: "var(--orange)" }} />

          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="leading-relaxed mb-8"
              style={{ fontSize: "clamp(20px, 2.4vw, 30px)", color: "var(--on-dark)", fontWeight: 500 }}
            >
              «{t.quote}»
            </motion.blockquote>
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <div>
                <div className="font-semibold" style={{ color: "var(--on-dark)" }}>{t.name}</div>
                <div className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{t.role}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={prev}
                aria-label="Назад"
                className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                aria-label="Вперёд"
                className="w-11 h-11 rounded-full flex items-center justify-center transition-colors text-white"
                style={{ background: "var(--orange)" }}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
