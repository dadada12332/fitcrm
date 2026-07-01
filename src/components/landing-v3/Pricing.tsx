"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { motion } from "framer-motion"
import { Reveal } from "@/components/landing/motion"

const plans = [
  { name: "Starter", monthly: 199000, features: ["До 100 клиентов", "Абонементы и оплаты", "QR-чекин", "Базовая аналитика", "1 сотрудник"], cta: "Начать бесплатно", href: "/register", hl: false },
  { name: "Standard", monthly: 399000, features: ["До 500 клиентов", "Всё из Starter", "Расписание и запись", "Telegram-бот", "До 5 сотрудников", "Приоритетная поддержка"], cta: "Начать 14 дней", href: "/register", hl: true },
  { name: "Business", monthly: 799000, features: ["Без ограничений", "Всё из Standard", "Несколько филиалов", "API доступ", "Выделенная поддержка"], cta: "Связаться", href: "/contact", hl: false },
]
const fmt = (n: number) => n.toLocaleString("ru-RU")

export function Pricing() {
  const [yearly, setYearly] = useState(false)
  return (
    <section id="pricing" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-10">
          <h2 className="font-semibold text-white mx-auto max-w-2xl" style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Простые тарифы под ваш масштаб
          </h2>
          <div className="v3-chip inline-flex items-center gap-1 mt-8 p-1 rounded-full">
            {[{ k: false, l: "Месяц" }, { k: true, l: "Год −20%" }].map((o) => (
              <button key={String(o.k)} onClick={() => setYearly(o.k)}
                className="px-5 py-2 rounded-full text-xs font-medium transition-colors"
                style={{ background: yearly === o.k ? "linear-gradient(100deg,#7c3aed,#2563eb)" : "transparent", color: yearly === o.k ? "#fff" : "rgba(255,255,255,0.6)" }}>
                {o.l}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {plans.map((p, i) => {
            const price = yearly ? Math.round(p.monthly * 0.8) : p.monthly
            return (
              <motion.div key={p.name}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
                className={`relative rounded-2xl p-7 flex flex-col ${p.hl ? "" : "v3-card"}`}
                style={p.hl ? { background: "linear-gradient(160deg,#7c3aed,#2563eb)", boxShadow: "0 40px 90px -30px rgba(124,58,237,0.7)" } : undefined}
              >
                <div className={`text-sm ${p.hl ? "text-white/85" : "text-white/60"}`}>{p.name}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-white">{fmt(price)}</span>
                  <span className={`text-xs ${p.hl ? "text-white/75" : "text-white/45"}`}>сум / мес</span>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1 mt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: p.hl ? "#fff" : "#a5b4fc" }} />
                      <span className={p.hl ? "text-white/90" : "text-white/70"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className={`mt-6 inline-flex items-center justify-center h-11 rounded-full text-sm font-medium transition-transform hover:scale-[1.01] ${p.hl ? "" : "v3-btn"}`}
                  style={p.hl ? { background: "#fff", color: "#4c1d95" } : undefined}>
                  {p.cta}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
