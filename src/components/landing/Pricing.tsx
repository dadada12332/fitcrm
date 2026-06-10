"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

const plans = [
  {
    name: "Starter",
    monthly: 199000,
    description: "Для небольших клубов до 100 клиентов",
    badge: null,
    features: ["До 100 активных клиентов", "Абонементы и оплаты", "QR-чекин", "Базовая аналитика", "1 сотрудник", "Email поддержка"],
    cta: "Начать бесплатно",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Standard",
    monthly: 399000,
    description: "Для клубов до 500 клиентов",
    badge: "Популярный",
    features: ["До 500 активных клиентов", "Всё из Starter", "Расписание и запись", "Telegram-бот", "До 5 сотрудников", "Приоритетная поддержка"],
    cta: "Начать бесплатно",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Business",
    monthly: 799000,
    description: "Для сетевых клубов без ограничений",
    badge: null,
    features: ["Без ограничений по клиентам", "Всё из Standard", "Несколько филиалов", "API доступ", "Неограниченные сотрудники", "Выделенная поддержка"],
    cta: "Связаться с нами",
    href: "/contact",
    highlighted: false,
  },
]

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU")
}

export function Pricing() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
            Тарифы
          </span>
          <h2 className="mt-4 mx-auto max-w-3xl" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 1 }}>
            Гибкие тарифы для команд любого размера
          </h2>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 mt-8 p-1 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            {[
              { key: false, label: "Месяц" },
              { key: true, label: "Год −20%" },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                onClick={() => setYearly(opt.key)}
                className="px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  fontFamily: "var(--font-display)",
                  background: yearly === opt.key ? "var(--orange)" : "transparent",
                  color: yearly === opt.key ? "#fff" : "var(--on-dark-soft)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const price = yearly ? Math.round(plan.monthly * 0.8) : plan.monthly
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -8, transition: { duration: 0.25, ease: "easeOut" } }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-3xl p-8 flex flex-col"
                style={
                  plan.highlighted
                    ? { background: "var(--orange)", color: "#fff" }
                    : { background: "var(--card)", border: "1px solid var(--border)" }
                }
              >
                {plan.badge && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold uppercase tracking-wider px-4 py-1 rounded-full"
                    style={{ background: "#0a0a0a", color: "#fff", fontFamily: "var(--font-display)" }}
                  >
                    {plan.badge}
                  </span>
                )}

                <h3 className="text-2xl mb-1" style={{ color: plan.highlighted ? "#fff" : "var(--on-dark)" }}>
                  {plan.name}
                </h3>
                <p className="text-sm mb-6" style={{ color: plan.highlighted ? "rgba(255,255,255,0.8)" : "var(--on-dark-soft)" }}>
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-2 mb-8">
                  <span style={{ fontSize: "40px", fontFamily: "var(--font-display)", color: plan.highlighted ? "#fff" : "var(--on-dark)" }}>
                    {formatPrice(price)}
                  </span>
                  <span className="text-sm" style={{ color: plan.highlighted ? "rgba(255,255,255,0.8)" : "var(--on-dark-soft)" }}>
                    сум / мес
                  </span>
                </div>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: plan.highlighted ? "#fff" : "var(--orange)" }} />
                      <span className="text-sm" style={{ color: plan.highlighted ? "rgba(255,255,255,0.9)" : "var(--on-dark-soft)" }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className="inline-flex items-center justify-center h-11 px-5 rounded-full text-xs font-semibold uppercase tracking-wider transition-transform hover:scale-[1.02]"
                  style={
                    plan.highlighted
                      ? { background: "#0a0a0a", color: "#fff", fontFamily: "var(--font-display)" }
                      : { background: "var(--orange)", color: "#fff", fontFamily: "var(--font-display)" }
                  }
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
