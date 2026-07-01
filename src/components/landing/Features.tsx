"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"

function Card({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: i * 0.08 }}
      className="sol-card sol-hover relative overflow-hidden p-7 md:p-8 min-h-[280px] flex flex-col"
    >
      {children}
    </motion.div>
  )
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-2.5 text-sm text-white/75">
          <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
          {t}
        </li>
      ))}
    </ul>
  )
}

/* ── Декоративные визуалы (CSS/SVG, синий акцент) ── */

function StackVisual() {
  return (
    <div className="absolute bottom-6 right-6 w-40 h-32 pointer-events-none" style={{ perspective: 600 }}>
      {[0, 1, 2].map((n) => (
        <div key={n} className="absolute right-0 rounded-lg"
          style={{
            width: 150 - n * 8, height: 44,
            bottom: n * 26, right: n * 10,
            background: n === 0 ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            transform: "rotateX(52deg) rotateZ(-32deg)",
            boxShadow: n === 0 ? "0 10px 30px -6px rgba(37,99,235,0.6)" : "none",
          }} />
      ))}
    </div>
  )
}

function SlabVisual() {
  return (
    <div className="absolute bottom-8 right-8 w-44 h-32 pointer-events-none" style={{ perspective: 700 }}>
      {[0, 1].map((n) => (
        <div key={n} className="absolute right-0 rounded-xl"
          style={{
            width: 170, height: 96, bottom: n * 14, right: n * 12,
            background: n === 1 ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            transform: "rotateX(58deg) rotateZ(-38deg)",
            boxShadow: n === 1 ? "0 14px 40px -8px rgba(37,99,235,0.6)" : "none",
          }} />
      ))}
    </div>
  )
}

function TreeVisual() {
  return (
    <svg className="absolute bottom-6 right-6 pointer-events-none" width="150" height="120" viewBox="0 0 150 120">
      <line x1="75" y1="24" x2="35" y2="80" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />
      <line x1="75" y1="24" x2="75" y2="80" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />
      <line x1="75" y1="24" x2="115" y2="80" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />
      <circle cx="75" cy="20" r="8" fill="#3b82f6" />
      {[35, 75, 115].map((x) => <circle key={x} cx={x} cy="86" r="6" fill="#60a5fa" />)}
    </svg>
  )
}

function CubeVisual() {
  return (
    <div className="absolute bottom-8 right-10 w-28 h-28 pointer-events-none" style={{ perspective: 600 }}>
      <div className="absolute inset-0 rounded-xl"
        style={{
          background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
          border: "1px solid rgba(255,255,255,0.15)",
          transform: "rotateX(-24deg) rotateY(38deg)",
          boxShadow: "0 20px 50px -10px rgba(37,99,235,0.65)",
        }} />
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="font-semibold text-white"
              style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              Всё, что нужно клубу —<br /><span className="text-accent">в одной системе</span>
            </motion.h2>
            <p className="mt-4 text-white/50 max-w-xl leading-relaxed">
              От первого клиента до сети залов. FitCRM закрывает весь цикл работы фитнес-клуба
              в одной платформе.
            </p>
          </div>
          <Link href="#usecases" className="btn-secondary self-start inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-medium flex-shrink-0">
            Смотреть демо <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 2×2 bento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card i={0}>
            <h3 className="text-xl font-medium text-white leading-snug">Клиенты и абонементы<br />в одном месте</h3>
            <p className="mt-3 text-sm text-white/55 max-w-[60%] leading-relaxed">
              Карточки клиентов, история посещений и оплат, заморозка и продление в один клик.
            </p>
            <Checklist items={["Карточки и история клиента", "Заморозка и продление", "Теги и сегменты"]} />
            <StackVisual />
          </Card>

          <Card i={1}>
            <h3 className="text-xl font-medium text-white leading-snug">Оплаты и онлайн-касса,<br />настроенные под Узбекистан</h3>
            <p className="mt-3 text-sm text-white/55 max-w-[62%] leading-relaxed">
              Приём платежей через Payme и Click, чеки, контроль долгов и выручки — без ручных таблиц.
            </p>
            <SlabVisual />
          </Card>

          <Card i={2}>
            <h3 className="text-xl font-medium text-white leading-snug">Расписание и записи<br />на группы и тренеров</h3>
            <p className="mt-3 text-sm text-white/55 max-w-[60%] leading-relaxed">
              Групповые и персональные занятия, залы, тренеры и онлайн-запись клиентов.
            </p>
            <Checklist items={["Групповые и персональные", "Залы и тренеры", "Онлайн-запись из бота"]} />
            <TreeVisual />
          </Card>

          <Card i={3}>
            <h3 className="text-xl font-medium text-white leading-snug">Интеграции и API<br />под ваш процесс</h3>
            <p className="mt-3 text-sm text-white/55 max-w-[62%] leading-relaxed">
              Telegram-бот, вебхуки, экспорт в Excel и открытый API — подключайте что угодно.
            </p>
            <CubeVisual />
          </Card>
        </div>
      </div>
    </section>
  )
}
