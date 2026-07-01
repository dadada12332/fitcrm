"use client"

import { motion } from "framer-motion"
import { Users, CreditCard, Wallet, QrCode, ShieldCheck, BarChart3 } from "lucide-react"
import { Reveal } from "@/components/landing/motion"

const items = [
  { icon: Users, title: "Клиентская база", desc: "Карточки с историей визитов, оплат, тегами и сегментами." },
  { icon: CreditCard, title: "Абонементы", desc: "Гибкие тарифы, продления и заморозка в один клик." },
  { icon: Wallet, title: "Онлайн-оплаты", desc: "Payme и Click, чеки, контроль долгов и выручки." },
  { icon: QrCode, title: "QR-чекин", desc: "Мгновенная фиксация посещений через Telegram-бота." },
  { icon: ShieldCheck, title: "Безопасность", desc: "Шифрование, роли и права доступа, журнал действий." },
  { icon: BarChart3, title: "Аналитика", desc: "Выручка, посещаемость и отток — дашборды и экспорт." },
]

export function Features() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="font-bold text-zinc-900 mx-auto max-w-2xl" style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Всё для управления клубом
          </h2>
          <p className="mt-4 v2-muted max-w-xl mx-auto">Инструменты корпоративного уровня для клубов любого размера.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
              className="v2-card v2-card-hover p-7"
            >
              <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50">
                <it.icon className="w-5 h-5 text-blue-600" />
              </span>
              <h3 className="mt-6 text-lg font-semibold text-zinc-900">{it.title}</h3>
              <p className="mt-2 text-sm v2-muted leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
