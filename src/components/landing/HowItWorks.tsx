"use client"

import { motion } from "framer-motion"

const steps = [
  {
    number: "01",
    title: "Зарегистрируйтесь",
    description: "Создайте аккаунт за 2 минуты. Никаких договоров и предоплаты — 14 дней бесплатного доступа.",
  },
  {
    number: "02",
    title: "Настройте клуб",
    description: "Добавьте абонементы, расписание, сотрудников. Импортируйте базу клиентов из Excel.",
  },
  {
    number: "03",
    title: "Начните работать",
    description: "Продавайте абонементы, фиксируйте посещения через QR и получайте аналитику в реальном времени.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <span
            className="inline-block text-xs font-semibold uppercase px-4 py-1.5 rounded-full mb-5"
            style={{
              background: "rgba(37,99,235,0.08)",
              color: "var(--orange)",
              letterSpacing: "0.12em",
            }}
          >
            Как это работает
          </span>
          <h2
            className="font-black tracking-tight"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)", letterSpacing: "-1.5px" }}
          >
            Запустите CRM за один день
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="flex flex-col"
            >
              <span
                className="font-black mb-4 leading-none select-none"
                style={{ fontSize: "56px", color: "var(--orange)" }}
              >
                {step.number}
              </span>
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--black)" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--gray-sub)" }}>
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
