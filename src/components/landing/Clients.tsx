"use client"

import { motion } from "framer-motion"
import { MessageCircle, Wallet, CreditCard, QrCode, BarChart3, Calendar, Database, Bell } from "lucide-react"

const clients = [
  { icon: MessageCircle, label: "Telegram" },
  { icon: Wallet, label: "Payme" },
  { icon: CreditCard, label: "Click" },
  { icon: QrCode, label: "QR-чекин" },
  { icon: Database, label: "Supabase" },
  { icon: BarChart3, label: "Аналитика" },
  { icon: Calendar, label: "Расписание" },
  { icon: Bell, label: "Уведомления" },
]

export function Clients() {
  return (
    <section className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
            От стартапов до сетей
          </span>
          <h2 className="mt-4 mx-auto max-w-3xl" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 1 }}>
            Высоко ценят ведущие клубы
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {clients.map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, transition: { duration: 0.25, ease: "easeOut" } }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-2xl h-28 flex items-center justify-center gap-3 hover:border-white/20"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Icon className="w-6 h-6 transition-colors" style={{ color: "var(--on-dark-soft)" }} />
              <span
                className="text-lg transition-colors"
                style={{ color: "var(--on-dark-soft)", fontFamily: "var(--font-display)", textTransform: "uppercase" }}
              >
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
