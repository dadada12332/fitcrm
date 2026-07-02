"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus } from "lucide-react"
import { Reveal } from "@/components/landing/motion"

const faqs = [
  { q: "Нужно ли что-то устанавливать?", a: "Нет. FitCRM работает в браузере — с любого устройства. Данные в облаке, резервные копии автоматически." },
  { q: "Можно перенести базу клиентов?", a: "Да, импорт из Excel/CSV. При переходе на Standard и выше помогаем с переносом вручную." },
  { q: "Как работает QR-чекин?", a: "Клиент получает личный QR в Telegram-боте. Скан на ресепшене — посещение фиксируется мгновенно." },
  { q: "Поддерживаются несколько филиалов?", a: "Да, на тарифе Business. Единый кабинет и раздельная аналитика по каждому клубу." },
  { q: "Какие способы оплаты?", a: "Payme и Click — и для оплаты тарифа, и для абонементов клиентов." },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center mb-12">
          <h2 className="font-bold text-zinc-900 mx-auto" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Частые вопросы
          </h2>
        </Reveal>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => {
            const active = open === i
            return (
              <Reveal key={f.q} delay={i * 0.04}>
                <div className="v2-card overflow-hidden">
                  <button onClick={() => setOpen(active ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="text-base font-semibold text-zinc-900">{f.q}</span>
                    <Plus className={`w-5 h-5 flex-shrink-0 text-zinc-400 transition-transform duration-300 ${active ? "rotate-45" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p className="px-6 pb-5 text-sm v2-muted leading-relaxed">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
