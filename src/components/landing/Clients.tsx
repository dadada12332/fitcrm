"use client"

import { motion } from "framer-motion"
import { Send, Wallet, CreditCard, Database, QrCode, BarChart3, Bell } from "lucide-react"

const logos = [
  { icon: Send, label: "Telegram" },
  { icon: Wallet, label: "Payme" },
  { icon: CreditCard, label: "Click" },
  { icon: Database, label: "Supabase" },
  { icon: QrCode, label: "QR-чекин" },
  { icon: BarChart3, label: "Аналитика" },
  { icon: Bell, label: "Уведомления" },
]

export function Clients() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-center text-xs text-white/40 mb-8">Работает с вашими сервисами</p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5"
        >
          {logos.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
              <Icon className="w-5 h-5" />
              <span className="text-base font-medium">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
