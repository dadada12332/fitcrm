"use client"

import { motion } from "framer-motion"
import { Send, BarChart3, UserPlus, Check } from "lucide-react"
import { Reveal } from "@/components/landing/motion"

/* Живые мини-демо возможностей FitCRM (framer-motion, зацикленные и по скроллу). */

function TelegramDemo() {
  const bubbles = [
    { side: "in", text: "Ваш абонемент истекает через 3 дня 💪" },
    { side: "out", text: "Продлить" },
    { side: "in", text: "✓ Оплата принята — активен до 12.09" },
  ]
  return (
    <div className="h-full flex flex-col rounded-xl p-3" style={{ background: "#e9edf2" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#2AABEE" }}>
          <Send className="w-2.5 h-2.5 text-white" />
        </span>
        <span className="text-[11px] font-semibold text-zinc-700">FitCRM Bot</span>
      </div>
      <div className="flex-1 flex flex-col gap-2 justify-end">
        {bubbles.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: [0, 1, 1, 1, 0], y: [8, 0, 0, 0, 0], scale: [0.96, 1, 1, 1, 1] }}
            transition={{ duration: 6, times: [0, 0.12, 0.9, 0.96, 1], delay: i * 0.7, repeat: Infinity, repeatDelay: 0.4, ease: "easeOut" }}
            className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-[11px] shadow-sm ${
              b.side === "out"
                ? "self-end rounded-br-sm text-white"
                : "self-start rounded-bl-sm bg-white text-zinc-700"
            }`}
            style={b.side === "out" ? { background: "#2AABEE" } : undefined}
          >
            {b.text}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ChartDemo() {
  const bars = [38, 55, 46, 68, 60, 82, 74, 92]
  return (
    <div className="h-full flex flex-col rounded-xl p-4 bg-white border border-zinc-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-zinc-800">Выручка за неделю</span>
        <span className="text-[10px] font-medium text-green-600">+23%</span>
      </div>
      <div className="text-[15px] font-bold text-zinc-900 mb-3">42 480 000 сум</div>
      <div className="flex-1 flex items-end gap-1.5">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: "0%" }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: false, margin: "-40px" }}
            transition={{ duration: 0.8, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 rounded-t-md"
            style={{ background: "linear-gradient(180deg,#3b82f6,#93c5fd)" }}
          />
        ))}
      </div>
    </div>
  )
}

function ClientsDemo() {
  const base = [
    ["Азиз Каримов", "Премиум"],
    ["Дилноза Рахимова", "Стандарт"],
    ["Тимур Маткаримов", "Годовой"],
  ]
  return (
    <div className="h-full flex flex-col rounded-xl p-4 bg-white border border-zinc-100">
      <div className="text-[11px] font-semibold text-zinc-800 mb-2">Клиенты</div>
      <div className="flex flex-col gap-1.5">
        {base.map((r, i) => (
          <motion.div
            key={r[0]}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.12 }}
            className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded-lg bg-zinc-50"
          >
            <span className="flex items-center gap-1.5 text-zinc-800">
              <span className="w-4 h-4 rounded-full bg-blue-100" />{r[0]}
            </span>
            <span className="text-zinc-500">{r[1]}</span>
          </motion.div>
        ))}
        {/* новый клиент «добавляется» в цикле */}
        <motion.div
          initial={{ opacity: 0, y: 10, height: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, 0], height: [0, 34, 34, 0] }}
          transition={{ duration: 4, times: [0, 0.2, 0.85, 1], repeat: Infinity, repeatDelay: 1, ease: "easeOut" }}
          className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded-lg overflow-hidden"
          style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
        >
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <UserPlus className="w-3 h-3" /> Малика Собирова
          </span>
          <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> добавлен</span>
        </motion.div>
      </div>
    </div>
  )
}

const rows = [
  {
    icon: Send, tag: "Telegram-бот",
    title: "Общение с клиентами на автопилоте",
    desc: "Напоминания об истечении, продления в один тап и подтверждение оплаты — бот работает за вас 24/7.",
    points: ["Автонапоминания", "Оплата в чате", "QR-чекин"],
    demo: TelegramDemo,
  },
  {
    icon: BarChart3, tag: "Отчёты",
    title: "Аналитика, которая строится на глазах",
    desc: "Выручка, посещаемость и отток обновляются в реальном времени. Экспорт в Excel и PDF в один клик.",
    points: ["Реальное время", "Экспорт Excel/PDF", "Прогнозы оттока"],
    demo: ChartDemo,
  },
  {
    icon: UserPlus, tag: "Клиенты",
    title: "База клиентов без хаоса",
    desc: "Добавляйте клиентов за секунды, храните историю визитов и оплат, сегментируйте для рассылок.",
    points: ["Быстрое добавление", "История и теги", "Сегменты"],
    demo: ClientsDemo,
  },
]

export function LiveFeatures() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <h2 className="font-bold text-zinc-900 mx-auto max-w-2xl" style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Не скриншоты — живой продукт
          </h2>
          <p className="mt-4 v2-muted max-w-xl mx-auto">Каждая возможность работает прямо на странице.</p>
        </Reveal>

        <div className="flex flex-col gap-16">
          {rows.map((r, i) => (
            <div key={r.tag} className={`grid lg:grid-cols-2 gap-8 lg:gap-14 items-center ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <Reveal>
                <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                  <r.icon className="w-3.5 h-3.5" /> {r.tag}
                </span>
                <h3 className="mt-4 font-bold text-zinc-900" style={{ fontSize: "clamp(22px, 2.6vw, 34px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                  {r.title}
                </h3>
                <p className="mt-3 v2-muted leading-relaxed max-w-md">{r.desc}</p>
                <ul className="mt-5 flex flex-col gap-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-sm text-zinc-700">
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <motion.div
                initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="v2-card p-3 h-[280px]"
              >
                <r.demo />
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
