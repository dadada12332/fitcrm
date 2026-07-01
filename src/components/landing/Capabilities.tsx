"use client"

import { motion } from "framer-motion"
import { Users, CreditCard, Wallet, QrCode, ShieldCheck, BarChart3 } from "lucide-react"

const items = [
  { icon: Users, title: "Клиентская база", desc: "Карточки клиентов с историей посещений, оплат, тегами и сегментами для рассылок." },
  { icon: CreditCard, title: "Абонементы и заморозка", desc: "Гибкие тарифы, продления, заморозка и контроль срока действия в один клик." },
  { icon: Wallet, title: "Онлайн-оплаты", desc: "Payme и Click, чеки, контроль долгов и выручки — всё связано с абонементами." },
  { icon: QrCode, title: "QR-чекин", desc: "Клиент показывает QR из бота — посещение фиксируется мгновенно, без очередей." },
  { icon: ShieldCheck, title: "Безопасность", desc: "Шифрование данных, роли и права доступа, журнал действий и резервные копии." },
  { icon: BarChart3, title: "Аналитика и отчёты", desc: "Выручка, посещаемость, отток и продления — дашборды и экспорт в Excel/PDF." },
]

export function Capabilities() {
  return (
    <section id="capabilities" className="py-24 px-4">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h2 className="font-semibold text-white mx-auto max-w-3xl" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Всё для управления клубом
          </h2>
          <p className="mt-4 text-white/50 max-w-2xl mx-auto leading-relaxed">
            Инструменты корпоративного уровня для клубов любого размера — от студии до сети залов.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
              className="sol-card sol-hover p-7 min-h-[200px]"
            >
              <span className="w-11 h-11 rounded-xl flex items-center justify-center sol-chip">
                <it.icon className="w-5 h-5 text-white/85" />
              </span>
              <h3 className="mt-6 text-lg font-medium text-white">{it.title}</h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
