"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

const plans = [
  {
    name: "Starter",
    monthly: 199000,
    suffix: "сум / мес",
    features: ["До 100 активных клиентов", "Абонементы и оплаты", "QR-чекин", "Базовая аналитика", "1 сотрудник"],
    cta: "Начать бесплатно",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Standard",
    monthly: 399000,
    suffix: "сум / мес",
    features: ["До 500 активных клиентов", "Всё из Starter", "Расписание и запись", "Telegram-бот", "До 5 сотрудников", "Приоритетная поддержка"],
    cta: "Начать 14 дней бесплатно",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Business",
    monthly: 799000,
    suffix: "сум / мес",
    features: ["Без ограничений по клиентам", "Всё из Standard", "Несколько филиалов", "API доступ", "Неограниченные сотрудники", "Выделенная поддержка"],
    cta: "Связаться с нами",
    href: "/contact",
    highlighted: false,
  },
]

function Mark({ light }: { light?: boolean }) {
  const c = light ? "#fff" : "var(--accent)"
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map((n) => (
        <span key={n} className="w-2 h-2 rounded-[2px]" style={{ background: c, opacity: n === 1 ? 1 : 0.6 }} />
      ))}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString("ru-RU")

export function Pricing() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="relative py-24 px-4 overflow-hidden">
      <div className="glow-blob" style={{ width: 500, height: 400, bottom: 60, left: -160, background: "radial-gradient(circle, rgba(37,99,235,0.25), transparent 70%)" }} />
      <div className="glow-blob" style={{ width: 500, height: 400, bottom: 60, right: -160, background: "radial-gradient(circle, rgba(37,99,235,0.22), transparent 70%)" }} />

      <div className="relative z-10 max-w-[1100px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <h2 className="font-semibold text-white mx-auto max-w-2xl" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Простые тарифы<br />под ваш масштаб
          </h2>

          <div className="inline-flex items-center gap-1 mt-8 p-1 rounded-full sol-card">
            {[
              { key: false, label: "Месяц" },
              { key: true, label: "Год −20%" },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                onClick={() => setYearly(opt.key)}
                className="px-5 py-2 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: yearly === opt.key ? "var(--accent-strong)" : "transparent",
                  color: yearly === opt.key ? "#fff" : "rgba(255,255,255,0.6)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {plans.map((plan, i) => {
            const price = yearly ? Math.round(plan.monthly * 0.8) : plan.monthly
            const hl = plan.highlighted
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.65, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
                className={`relative rounded-2xl p-7 flex flex-col ${hl ? "" : "sol-card"}`}
                style={hl ? { background: "var(--accent-strong)", boxShadow: "0 40px 90px -30px rgba(37,99,235,0.7)" } : undefined}
              >
                <Mark light={hl} />
                <div className={`mt-5 text-sm ${hl ? "text-white/85" : "text-white/60"}`}>{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-white">{fmt(price)}</span>
                  <span className={`text-xs ${hl ? "text-white/75" : "text-white/45"}`}>{plan.suffix}</span>
                </div>

                <div className={`mt-5 mb-4 text-xs ${hl ? "text-white/75" : "text-white/45"}`}
                  style={{ borderBottom: hl ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
                  Что входит:
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: hl ? "#fff" : "var(--accent)" }} />
                      <span className={hl ? "text-white/90" : "text-white/70"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-6 inline-flex items-center justify-center h-11 rounded-full text-sm font-medium transition-transform hover:scale-[1.01] ${hl ? "" : "btn-primary"}`}
                  style={hl ? { background: "#fff", color: "#0a0a0a" } : undefined}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
