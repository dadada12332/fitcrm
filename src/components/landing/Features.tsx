"use client"

import { motion } from "framer-motion"
import { Users, CreditCard, QrCode, Calendar, BarChart3, MessageCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  iconBg: string
  iconColor: string
}

const features: Feature[] = [
  {
    icon: Users,
    title: "Управление клиентами",
    description: "База клиентов с историей посещений и документами. Мгновенный поиск по имени или телефону.",
    iconBg: "rgba(14,165,233,0.12)",
    iconColor: "#0ea5e9",
  },
  {
    icon: CreditCard,
    title: "Абонементы и оплаты",
    description: "Продажа, продление, заморозка. Интеграция с Payme и Click — оплата прямо в системе.",
    iconBg: "rgba(16,185,129,0.12)",
    iconColor: "#10b981",
  },
  {
    icon: QrCode,
    title: "QR-чекин",
    description: "Клиент показывает QR-код — сканирование мгновенное. Посещение фиксируется автоматически.",
    iconBg: "rgba(139,92,246,0.12)",
    iconColor: "#8b5cf6",
  },
  {
    icon: Calendar,
    title: "Расписание занятий",
    description: "Групповые тренировки, запись клиентов, управление залами. Напоминания отправляются автоматически.",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#f59e0b",
  },
  {
    icon: BarChart3,
    title: "Аналитика и отчёты",
    description: "Выручка, посещаемость, конверсия, истекающие абонементы — все данные в реальном времени.",
    iconBg: "rgba(14,165,233,0.12)",
    iconColor: "#0ea5e9",
  },
  {
    icon: MessageCircle,
    title: "Telegram-бот",
    description: "Клиенты проверяют баланс, записываются на занятия и получают напоминания в Telegram.",
    iconBg: "rgba(59,130,246,0.12)",
    iconColor: "#3b82f6",
  },
]

export function Features() {
  return (
    <section
      id="features"
      className="py-28 relative"
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
            style={{
              background: "rgba(14,165,233,0.1)",
              color: "#0ea5e9",
              letterSpacing: "0.12em",
            }}
          >
            Возможности
          </span>
          <h2
            className="font-black tracking-tight mb-4"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)", letterSpacing: "-1px", color: "var(--ink)" }}
          >
            Всё что нужно фитнес-клубу
          </h2>
          <p className="text-base max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
            FitCRM закрывает все операционные задачи — от продажи абонемента до аналитики.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="rounded-2xl p-7"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 4px 24px rgba(14,101,173,0.06)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: feature.iconBg }}
                >
                  <Icon className="w-5 h-5" style={{ color: feature.iconColor }} />
                </div>
                <h3
                  className="font-semibold mb-2.5"
                  style={{ fontSize: "17px", color: "var(--ink)" }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
