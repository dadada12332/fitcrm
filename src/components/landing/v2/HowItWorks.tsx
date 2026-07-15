"use client"

import { motion } from "framer-motion"
import { Users, GitBranch, QrCode, ShieldCheck, BarChart2, Bell, ArrowUpRight } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const ICONS = [Users, GitBranch, BarChart2, ShieldCheck, Bell, QrCode]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay },
})

export function HowItWorks() {
  const t = useT()
  const cards = ICONS.map((icon, i) => ({ icon, title: t.how.cards[i].t, desc: t.how.cards[i].d }))
  return (
    <section id="howitworks" className="py-24 md:py-32" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1240px] px-6">
        {/* Header — по центру */}
        <div className="max-w-[720px] mx-auto text-center mb-14">
          <motion.h2 {...fadeUp(0)} className="text-[40px] md:text-[52px] font-normal leading-[1.05] tracking-[-1.4px] text-[#0a0a0a]">
            {t.how.title1} <span className="text-[#a1a1aa]">{t.how.title2}</span>
          </motion.h2>
          <motion.p {...fadeUp(0.08)} className="text-[16px] font-normal leading-[24px] text-[#52525b] mt-4">
            {t.how.subtitle}
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div key={card.title} {...fadeUp(i * 0.06)}
                className="group relative rounded-[18px] p-6 transition-all duration-300 hover:-translate-y-1.5"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)" }}>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <Icon className="w-6 h-6" style={{ color: "#27272a" }} strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300" style={{ color: "#a1a1aa" }} />
                </div>

                <h4 className="text-[17px] font-semibold text-[#0a0a0a] leading-[24px] mt-5 tracking-[-0.2px]">{card.title}</h4>
                <p className="text-[14px] font-normal leading-[21px] text-[#52525b] mt-2">{card.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
