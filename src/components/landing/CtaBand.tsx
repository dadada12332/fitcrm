"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export function CtaBand() {
  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="font-semibold text-white mx-auto" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Запустите свой клуб на <span className="text-accent">FitCRM</span> сегодня
        </h2>
        <p className="mt-4 text-white/55 max-w-xl mx-auto leading-relaxed">
          Сотни фитнес-клубов уже управляют бизнесом умнее. Присоединяйтесь — первые 14 дней бесплатно.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Начать бесплатно
          </Link>
          <Link href="#usecases" className="btn-secondary inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">
            Смотреть демо
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
