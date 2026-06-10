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
    <section id="faq" className="py-24 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1500px] mx-auto grid lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
            FAQ
          </span>
          <h2 className="mt-4" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1 }}>
            Вопросы?<br />У нас есть ответы
          </h2>
          <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>
            Не нашли ответ? Напишите нам в Telegram — ответим в течение часа.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion multiple={false} className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl px-6"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <AccordionTrigger
                  className="text-left py-5 text-base font-semibold hover:no-underline"
                  style={{ color: "var(--on-dark)" }}
                >
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent
                  className="pb-5 text-sm leading-relaxed"
                  style={{ color: "var(--on-dark-soft)" }}
                >
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
