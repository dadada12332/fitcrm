"use client"

import Link from "next/link"
import { Reveal } from "@/components/landing/motion"

export function CtaBand() {
  return (
    <section className="py-24 px-4">
      <Reveal className="max-w-4xl mx-auto">
        <div className="rounded-[28px] px-8 py-16 text-center text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)", boxShadow: "0 40px 90px -30px rgba(37,99,235,0.6)" }}>
          <h2 className="font-bold mx-auto max-w-2xl" style={{ fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Запустите клуб на FitCRM сегодня
          </h2>
          <p className="mt-4 text-white/80 max-w-lg mx-auto">Первые 14 дней бесплатно. Без карты, без риска.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="inline-flex items-center h-11 px-6 rounded-full text-sm font-semibold bg-white text-blue-700 hover:bg-zinc-100 transition-colors">
              Начать бесплатно
            </Link>
            <Link href="#work" className="inline-flex items-center h-11 px-6 rounded-full text-sm font-semibold border border-white/40 text-white hover:bg-white/10 transition-colors">
              Смотреть экраны
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
