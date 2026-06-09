"use client"

import { motion } from "framer-motion"

const steps = [
  {
    number: "01",
    title: "Зарегистрируйтесь",
    description: "Создайте аккаунт за 2 минуты. Никаких договоров и предоплаты — 14 дней бесплатного доступа.",
    color: "#0ea5e9",
  },
  {
    number: "02",
    title: "Настройте клуб",
    description: "Добавьте абонементы, расписание, сотрудников. Импортируйте базу клиентов из Excel.",
    color: "#8b5cf6",
  },
  {
    number: "03",
    title: "Начните работать",
    description: "Продавайте абонементы, фиксируйте посещения через QR и получайте аналитику в реальном времени.",
    color: "#10b981",
  },
]

export function HowItWorks() {
  return (
    <section
      className="py-28 relative"
      style={{
        background: "linear-gradient(180deg, #eaf6fd 0%, #d6eefa 50%, #b3dff5 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span
            className="inline-block text-xs font-semibold uppercase px-4 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(255,255,255,0.5)",
              color: "var(--ink-soft)",
              letterSpacing: "0.12em",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            Как это работает
          </span>
          <h2
            className="font-black tracking-tight"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)", letterSpacing: "-1px", color: "var(--ink)" }}
          >
            Запустите CRM за один день
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.12 }}
              className="rounded-2xl p-8"
              style={{
                background: "rgba(255,255,255,0.45)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 4px 24px rgba(14,101,173,0.08)",
              }}
            >
              <div
                className="text-5xl font-black mb-6 leading-none select-none"
                style={{ color: step.color, opacity: 0.2 }}
              >
                {step.number}
              </div>
              <div
                className="w-8 h-1 rounded-full mb-5"
                style={{ background: step.color }}
              />
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--ink)" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
