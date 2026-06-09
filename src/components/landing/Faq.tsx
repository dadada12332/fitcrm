"use client"

import { motion } from "framer-motion"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    q: "Нужно ли устанавливать что-то на компьютер?",
    a: "Нет. FitCRM работает в браузере — достаточно любого устройства с интернетом. Данные хранятся в облаке, резервные копии создаются автоматически.",
  },
  {
    q: "Могу ли я перенести базу клиентов из другой системы?",
    a: "Да. Поддерживается импорт из Excel/CSV. Для переноса из Deepen.uz или других систем — мы помогаем вручную при переходе на тариф Standard и выше.",
  },
  {
    q: "Как работает QR-чекин?",
    a: "Каждый клиент получает личный QR-код в профиле или Telegram-боте. Менеджер или терминал сканирует код — посещение фиксируется мгновенно.",
  },
  {
    q: "Работает ли Telegram-бот без стабильного интернета?",
    a: "Telegram-бот требует интернет-соединения. Оффлайн-режим для QR-чекина планируется в V2.",
  },
  {
    q: "Можно ли использовать FitCRM для нескольких филиалов?",
    a: "Да, управление несколькими филиалами доступно на тарифе Business. Единый кабинет, раздельная аналитика по каждому клубу.",
  },
  {
    q: "Как происходит оплата — Click или Payme?",
    a: "Оплата тарифа принимается через Click и Payme. Оба сервиса также поддерживаются для оплаты абонементов клиентами.",
  },
]

export function Faq() {
  return (
    <section
      id="faq"
      className="py-28"
      style={{ background: "linear-gradient(180deg, #eaf6fd 0%, #f5fbff 100%)" }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <span
              className="inline-block text-xs font-semibold uppercase px-4 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(14,165,233,0.1)", color: "#0ea5e9", letterSpacing: "0.12em" }}
            >
              FAQ
            </span>
            <h2
              className="font-black tracking-tight mb-4"
              style={{ fontSize: "clamp(26px, 3vw, 40px)", letterSpacing: "-1px", color: "var(--ink)" }}
            >
              Частые вопросы
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Не нашли ответ? Напишите нам в Telegram — ответим в течение часа.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Accordion multiple={false} className="flex flex-col gap-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="rounded-xl px-6"
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.75)",
                    boxShadow: "0 2px 12px rgba(14,101,173,0.05)",
                  }}
                >
                  <AccordionTrigger
                    className="text-left py-5 text-sm font-semibold hover:no-underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent
                    className="pb-5 text-sm leading-relaxed"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
