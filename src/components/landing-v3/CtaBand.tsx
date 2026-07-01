"use client"

import Link from "next/link"
import { Reveal } from "@/components/landing/motion"

export function CtaBand() {
  return (
    <section className="relative py-28 px-4 overflow-hidden">
      <div className="v3-aurora" style={{ top: "-200px", opacity: 0.4 }} />
      <Reveal className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-semibold text-white mx-auto" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          Запустите клуб на <span className="v3-text-gradient">FitCRM</span> сегодня
        </h2>
        <p className="mt-4 text-white/55 max-w-lg mx-auto leading-relaxed">Первые 14 дней бесплатно. Без карты, без риска.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="v3-btn inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">Начать бесплатно</Link>
          <Link href="#features" className="v3-btn-ghost inline-flex items-center h-11 px-6 rounded-full text-sm font-medium">Смотреть демо</Link>
        </div>
      </Reveal>
    </section>
  )
}
