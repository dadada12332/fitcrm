"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
const slides = [
  {
    src: "/screens/dashboard.png",
    badge: "Аналитика",
    title: "Полная картина\nвашего клуба",
    desc: "Выручка, посещения и ключевые метрики в реальном времени. ИИ-аналитика подскажет, что улучшить.",
  },
  {
    src: "/screens/settings.png",
    badge: "Настройки",
    title: "Полный контроль\nнад клубом",
    desc: "Рабочие часы, адрес, валюта, роли сотрудников и интеграции — всё настраивается за минуты.",
  },
  {
    src: "/screens/staff.png",
    badge: "Команда",
    title: "Управление\nсотрудниками",
    desc: "Тренеры, администраторы и менеджеры — роли, доступы и зарплаты в одном месте.",
  },
]

export function BrandingCarousel() {
  const [idx, setIdx] = useState(0)
  const [textVisible, setTextVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setTextVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % slides.length)
        setTextVisible(true)
      }, 300)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  function goTo(i: number) {
    if (i === idx) return
    setTextVisible(false)
    setIdx(i)
    setTimeout(() => setTextVisible(true), 300)
  }

  const slide = slides[idx]

  return (
    <div className="flex flex-col h-full" style={{ padding: "28px" }}>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0" style={{ marginBottom: 20 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="5" fill="white" fillOpacity="0.12" />
          <path d="M7 12H17M12 7V17" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-white font-semibold" style={{ fontSize: 20, letterSpacing: "-0.12px" }}>fitCRM</span>
      </Link>

      {/* Sliding track */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden shadow-2xl relative"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Track — all slides in a row */}
        <div
          className="flex h-full"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${idx * (100 / slides.length)}%)`,
            transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {slides.map((s, i) => (
            <div key={i} className="relative h-full" style={{ width: `${100 / slides.length}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.badge}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "top left",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: 80, background: "linear-gradient(to bottom, transparent, #0f172a)" }} />
      </div>

      {/* Text — fades on slide change */}
      <div style={{ transition: "opacity 0.25s ease", opacity: textVisible ? 1 : 0, marginTop: 20 }}>
        <div className="inline-flex items-center gap-1.5 font-medium px-3 py-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontSize: 12, marginBottom: 10 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.6)" }} />
          {slide.badge}
        </div>
        <h2 className="text-white font-bold whitespace-pre-line"
          style={{ fontSize: 24, letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 8 }}>
          {slide.title}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.5)" }}>
          {slide.desc}
        </p>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 24 : 7,
              height: 7,
              background: i === idx ? "white" : "rgba(255,255,255,0.22)",
            }} />
        ))}
      </div>
    </div>
  )
}
