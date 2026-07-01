"use client"

import { motion } from "framer-motion"
import { TrendingUp } from "lucide-react"

const cases = [
  {
    tag: "Удержание",
    title: "Больше продлений абонементов",
    desc: "Автонапоминания за 3 и 1 день до истечения, предложения продления с кнопкой оплаты в Telegram.",
    stat: "На 30% больше продлений",
  },
  {
    tag: "Оплаты",
    title: "Меньше долгов и просрочек",
    desc: "Онлайн-оплаты через Payme и Click, автоматический контроль задолженностей и напоминания.",
    stat: "−40% долгов по абонементам",
  },
  {
    tag: "Ресепшн",
    title: "Меньше рутины на стойке",
    desc: "QR-чекин и Telegram-бот: клиенты сами проверяют баланс и записываются, разгружая администратора.",
    stat: "Часы экономии каждый день",
  },
  {
    tag: "Аналитика",
    title: "Решения на данных",
    desc: "Дашборды по выручке, посещаемости и оттоку — видно, где растёт клуб, а где теряет клиентов.",
    stat: "+23% выручки за квартал",
  },
]

export function UseCases() {
  return (
    <section id="usecases" className="py-24 px-4">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h2 className="font-semibold text-white mx-auto max-w-3xl" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            FitCRM работает на весь клуб
          </h2>
          <p className="mt-4 text-white/50 max-w-2xl mx-auto leading-relaxed">
            От ресепшена до руководителя — каждый видит то, что нужно именно ему.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: (i % 2) * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
              className="sol-card sol-hover p-7 md:p-8 min-h-[220px] flex flex-col"
            >
              <span className="self-start text-xs px-2.5 py-1 rounded-full mb-4"
                style={{ background: "rgba(37,99,235,0.15)", color: "#93b4ff", border: "1px solid rgba(37,99,235,0.25)" }}>
                {c.tag}
              </span>
              <h3 className="text-xl font-medium text-white">{c.title}</h3>
              <p className="mt-3 text-sm text-white/55 leading-relaxed flex-1">{c.desc}</p>
              <div className="mt-5 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--accent)" }}>
                <TrendingUp className="w-4 h-4" />
                {c.stat}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
