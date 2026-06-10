"use client"

import { motion } from "framer-motion"
import { Wrench, Users, Clock, TrendingUp, ShieldCheck, MessageCircle, Wallet, CreditCard, QrCode } from "lucide-react"

const miniBars = [40, 65, 50, 78, 92, 70]

function Card({
  children,
  className = "",
  i = 0,
  style,
}: {
  children: React.ReactNode
  className?: string
  i?: number
  style?: React.CSSProperties
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, transition: { duration: 0.25, ease: "easeOut" } }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: i * 0.06 }}
      className={`rounded-3xl p-7 flex flex-col ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)", ...style }}
    >
      {children}
    </motion.div>
  )
}

export function Features() {
  return (
    <section id="features" className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-8 items-end mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 0.98 }}
          >
            Функции, которыми<br />захочется хвастаться
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base leading-relaxed"
            style={{ color: "var(--on-dark-soft)" }}
          >
            Всё, что нужно фитнес-клубу — клиенты, абонементы, оплаты,
            расписание и аналитика — собрано в одной системе. Рассмотрим
            возможности платформы поближе.
          </motion.p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Adaptable tools */}
          <Card i={0}>
            <Wrench className="w-7 h-7 mb-6" style={{ color: "var(--orange)" }} />
            <h3 className="text-2xl mb-2">Гибкие инструменты</h3>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
              Настраивайте абонементы, услуги и роли сотрудников под свой клуб.
            </p>
          </Card>

          {/* Data-backed — accent blue with chart */}
          <Card i={1} style={{ background: "var(--orange)", border: "none" }}>
            <span className="text-xs uppercase tracking-wider mb-4 text-white/80" style={{ fontFamily: "var(--font-display)" }}>
              Решения на данных
            </span>
            <div className="flex items-end gap-2 h-24 mb-4">
              {miniBars.map((h, idx) => (
                <motion.div
                  key={idx}
                  className="flex-1 rounded-t-md"
                  style={{ background: "rgba(255,255,255,0.85)" }}
                  initial={{ height: "0%" }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.7, delay: 0.2 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
            <div className="text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>₸ 4 248 000</div>
          </Card>

          {/* Plays well with others */}
          <Card i={2}>
            <Users className="w-7 h-7 mb-6" style={{ color: "var(--orange)" }} />
            <h3 className="text-2xl mb-4">Работает со всеми</h3>
            <div className="flex gap-2 mt-auto">
              {[MessageCircle, Wallet, CreditCard, QrCode].map((Icon, idx) => (
                <div
                  key={idx}
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--on-dark-soft)" }} />
                </div>
              ))}
            </div>
          </Card>

          {/* Time is money — cream */}
          <Card i={3} style={{ background: "var(--card-light)", border: "none" }}>
            <Clock className="w-7 h-7 mb-6" style={{ color: "var(--orange)" }} />
            <h3 className="text-2xl mb-2" style={{ color: "#0a0a0a" }}>Время — деньги</h3>
            <p className="text-sm" style={{ color: "rgba(10,10,10,0.6)" }}>
              Автоматизация рутины: напоминания, продления, отчёты без ручной работы.
            </p>
          </Card>

          {/* Productivity */}
          <Card i={4}>
            <TrendingUp className="w-7 h-7 mb-6" style={{ color: "var(--orange)" }} />
            <h3 className="text-2xl mb-2">Рост продуктивности</h3>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
              Меньше рутины — больше времени на клиентов и развитие клуба.
            </p>
          </Card>

          {/* Security */}
          <Card i={5}>
            <ShieldCheck className="w-7 h-7 mb-6" style={{ color: "var(--orange)" }} />
            <h3 className="text-2xl mb-2">Спите спокойно</h3>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
              Шифрование данных, резервные копии и контроль доступа — мы прикроем.
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}
