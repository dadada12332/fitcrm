"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

const plans = [
  {
    name: "Starter",
    price: "199 000",
    period: "сум / мес",
    description: "Для небольших клубов до 100 клиентов",
    badge: null,
    features: ["До 100 активных клиентов", "Абонементы и оплаты", "QR-чекин", "Базовая аналитика", "1 сотрудник", "Email поддержка"],
    cta: "Начать бесплатно",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Standard",
    price: "399 000",
    period: "сум / мес",
    description: "Для клубов до 500 клиентов",
    badge: "Популярный",
    features: ["До 500 активных клиентов", "Всё из Starter", "Расписание и запись", "Telegram-бот", "До 5 сотрудников", "Приоритетная поддержка"],
    cta: "Начать бесплатно",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Business",
    price: "799 000",
    period: "сум / мес",
    description: "Для сетевых клубов без ограничений",
    badge: null,
    features: ["Без ограничений по клиентам", "Всё из Standard", "Несколько филиалов", "API доступ", "Неограниченные сотрудники", "Выделенная поддержка"],
    cta: "Связаться с нами",
    href: "/contact",
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-28"
      style={{ background: "linear-gradient(180deg, #f5fbff 0%, #eaf6fd 100%)" }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="inline-block text-xs font-semibold uppercase px-4 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(14,165,233,0.1)", color: "#0ea5e9", letterSpacing: "0.12em" }}
          >
            Тарифы
          </span>
          <h2
            className="font-black tracking-tight mb-4"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)", letterSpacing: "-1px", color: "var(--ink)" }}
          >
            Прозрачные цены
          </h2>
          <p className="text-base" style={{ color: "var(--ink-soft)" }}>
            14 дней бесплатно для любого тарифа. Без скрытых платежей.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className="relative rounded-2xl p-8 flex flex-col"
              style={
                plan.highlighted
                  ? {
                      background: "var(--cta-dark)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 20px 60px rgba(15,23,41,0.3)",
                    }
                  : {
                      background: "rgba(255,255,255,0.65)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.75)",
                      boxShadow: "0 4px 24px rgba(14,101,173,0.07)",
                    }
              }
            >
              {plan.badge && (
                <span
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-4 py-1 rounded-full"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  {plan.badge}
                </span>
              )}

              <div className="mb-8">
                <h3
                  className="font-semibold mb-1 text-base"
                  style={{ color: plan.highlighted ? "var(--on-dark)" : "var(--ink)" }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-sm mb-6"
                  style={{ color: plan.highlighted ? "var(--on-dark-soft)" : "var(--ink-soft)" }}
                >
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-black"
                    style={{
                      fontSize: "32px",
                      letterSpacing: "-1px",
                      color: plan.highlighted ? "var(--on-dark)" : "var(--ink)",
                    }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: plan.highlighted ? "var(--on-dark-soft)" : "var(--muted)" }}
                  >
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: plan.highlighted ? "#38bdf8" : "#0ea5e9" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: plan.highlighted ? "var(--on-dark-soft)" : "var(--ink-soft)" }}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className="inline-flex items-center justify-center h-11 px-5 rounded-xl text-sm font-semibold transition-colors"
                style={
                  plan.highlighted
                    ? { background: "rgba(255,255,255,0.12)", color: "var(--on-dark)", border: "1px solid rgba(255,255,255,0.2)" }
                    : { background: "var(--cta-dark)", color: "#fff" }
                }
                onMouseEnter={e => {
                  e.currentTarget.style.background = plan.highlighted
                    ? "rgba(255,255,255,0.2)"
                    : "var(--cta-dark-hover)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = plan.highlighted
                    ? "rgba(255,255,255,0.12)"
                    : "var(--cta-dark)"
                }}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
