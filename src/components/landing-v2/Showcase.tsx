"use client"

import { motion } from "framer-motion"
import { DashboardScreen, ClientsScreen, PaymentsScreen, ReportsScreen, TelegramScreen } from "./screens"

const items = [
  { screen: DashboardScreen, name: "Дашборд", tag: "Обзор клуба", color: "#2563eb" },
  { screen: ClientsScreen, name: "Клиенты", tag: "База и абонементы", color: "#7c3aed" },
  { screen: PaymentsScreen, name: "Платежи", tag: "Payme · Click", color: "#16a34a" },
  { screen: ReportsScreen, name: "Отчёты", tag: "Аналитика и экспорт", color: "#ea580c" },
  { screen: TelegramScreen, name: "Telegram-бот", tag: "QR-чекин и рассылки", color: "#0ea5e9" },
]

export function Showcase() {
  return (
    <section id="work" className="pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="v2-fade-x overflow-x-auto no-scrollbar"
      >
        <div className="flex gap-5 px-[max(1rem,calc((100vw-1200px)/2))] w-max snap-x">
          {items.map((it) => (
            <div key={it.name} className="snap-center flex-shrink-0 w-[380px]">
              <div
                className="rounded-[22px] p-1.5 transition-transform duration-300 hover:-translate-y-1.5"
                style={{ background: it.color, boxShadow: `0 30px 60px -30px ${it.color}99` }}
              >
                <div className="rounded-[16px] overflow-hidden h-[268px] bg-white">
                  <it.screen />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 px-1">
                <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: it.color }} />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-zinc-900">{it.name}</div>
                  <div className="text-xs v2-muted">{it.tag}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
