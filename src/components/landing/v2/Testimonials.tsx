"use client"

import { motion } from "framer-motion"

const FEATURED = {
  quote: "Мы перешли с Excel на FitCRM за один вечер. Через неделю выручка стала прозрачной, а администраторы перестали тонуть в бумагах. Эффект был мгновенным.",
  name: "Азиз Каримов",
  role: "Владелец, FitLife Tashkent",
  initials: "АК",
}

const SLIDES = ["01", "02", "03"]

const GRID = [
  { name: "Нилуфар Рашидова", role: "Менеджер, PowerGym",          quote: "QR-чекин — просто бомба. Клиенты сканируют код на входе, никаких очередей." },
  { name: "Сардор Юлдашев",   role: "Основатель, Humo Fitness",    quote: "Telegram-бот клиенты обожают. Проверяют баланс сами, без звонков администратору." },
  { name: "Камола Усманова",  role: "Директор, Lady Sport Club",   quote: "Управляю тремя филиалами из одного окна. Раньше был кошмар, теперь всё прозрачно." },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease: "easeOut" as const, delay },
})

export function Testimonials() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32" style={{ background: "#ffffff" }}>
      {/* Blue bg glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,101,252,0.06), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-8">

        {/* Featured quote */}
        <motion.div {...fadeUp(0)} className="flex flex-col items-center text-center max-w-[896px] mx-auto pb-16">
          {/* Avatar */}
          <div className="w-[90px] h-[90px] rounded-full flex items-center justify-center text-2xl font-medium text-[#0065fc] mb-8"
            style={{ background: "rgba(0,101,252,0.1)", border: "2px solid rgba(0,101,252,0.2)" }}>
            {FEATURED.initials}
          </div>

          <blockquote className="text-[28px] md:text-[36px] font-normal leading-[1.3] text-[#0a0a0a] text-center">
            «{FEATURED.quote}»
          </blockquote>

          <div className="mt-8 flex items-center gap-8">
            {/* Slide indicators */}
            <div className="flex items-center gap-4">
              <button className="text-[14px] font-normal text-[#0a0a0a] leading-[20px]">01</button>
              <div className="h-px w-28 bg-black/20" />
              {SLIDES.slice(1).map(s => (
                <button key={s} className="text-[14px] font-normal text-[#52525b] leading-[20px] hover:text-[#0a0a0a] transition-colors">{s}</button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[16px] font-medium text-[#0a0a0a]">{FEATURED.name}</p>
            <p className="text-[14px] text-[#52525b]">{FEATURED.role}</p>
          </div>
        </motion.div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GRID.map((t, i) => (
            <motion.div key={t.name} {...fadeUp(i * 0.08)}
              className="flex flex-col gap-4 rounded-[14px] border border-black/[0.08] p-6 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.1)] transition-shadow"
              style={{ background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <p className="text-[15px] font-normal leading-[22px] text-[#52525b] flex-1">
                «{t.quote}»
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-black/[0.06]">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium text-[#0065fc] shrink-0"
                  style={{ background: "rgba(0,101,252,0.1)", border: "1px solid rgba(0,101,252,0.2)" }}>
                  {t.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#0a0a0a] truncate">{t.name}</p>
                  <p className="text-[12px] text-[#52525b] truncate">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
