"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Globe, Send, PlayCircle, ArrowUpRight } from "lucide-react"

const actions = [
  {
    icon: Globe,
    title: "Веб-версия",
    desc: "Откройте FitCRM в браузере — без установки",
    href: "/register",
  },
  {
    icon: Send,
    title: "Telegram-бот",
    desc: "Чекин, баланс и записи прямо в Telegram",
    href: "https://t.me/fitcrm_uz",
  },
  {
    icon: PlayCircle,
    title: "Запросить демо",
    desc: "Покажем систему на примере вашего клуба",
    href: "/contact",
  },
]

export function Download() {
  return (
    <section id="download" className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
            Попробуйте прямо сейчас
          </span>
          <h2 className="mt-4 mx-auto max-w-3xl" style={{ fontSize: "clamp(32px, 5vw, 64px)", lineHeight: 0.98 }}>
            Начните работать<br />с FitCRM
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map(({ icon: Icon, title, desc, href }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link
                href={href}
                className="group rounded-3xl p-7 flex flex-col h-full transition-transform hover:scale-[1.02]"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between mb-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(37,99,235,0.15)" }}
                  >
                    <Icon className="w-6 h-6" style={{ color: "var(--orange)" }} />
                  </div>
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--on-dark-soft)" }} />
                </div>
                <h3 className="text-2xl mb-2">{title}</h3>
                <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
