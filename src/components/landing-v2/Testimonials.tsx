"use client"

import { motion } from "framer-motion"
import { Quote } from "lucide-react"
import { Reveal } from "@/components/landing/motion"

const items = [
  { quote: "Продлений стало больше, а рутины меньше. Команда наконец занимается клиентами, а не таблицами.", name: "Тимур Маткаримов", role: "PowerGym Ташкент", color: "#fbbf24" },
  { quote: "QR-чекин и бот сняли нагрузку с ресепшена. Экономим часы каждый день.", name: "Дилноза Рахимова", role: "FitZone Самарканд", color: "#f472b6" },
  { quote: "Аналитика помогла поднять выручку на 23% за квартал. Вижу всё в реальном времени.", name: "Азиз Каримов", role: "IronHouse", color: "#34d399" },
]

export function Testimonials() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="font-bold text-zinc-900 mx-auto max-w-2xl" style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Клубы уже растут с FitCRM
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
              className="v2-card v2-card-hover p-7 flex flex-col"
            >
              <Quote className="w-7 h-7 text-blue-600 mb-4" />
              <p className="text-zinc-800 leading-relaxed flex-1">«{t.quote}»</p>
              <div className="flex items-center gap-3 mt-6">
                <span className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-zinc-900">{t.name}</div>
                  <div className="text-xs v2-muted">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
