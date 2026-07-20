"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  const activeIndex = useRef(0)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback((nextIndex: number) => {
    setTextVisible(false)
    if (transitionTimer.current) clearTimeout(transitionTimer.current)

    transitionTimer.current = setTimeout(() => {
      activeIndex.current = nextIndex
      setIdx(nextIndex)
      setTextVisible(true)
      transitionTimer.current = null
    }, 300)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => goTo((activeIndex.current + 1) % slides.length), 3500)
    return () => {
      clearInterval(timer)
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
    }
  }, [goTo])

  const slide = slides[idx]

  return (
    <div className="flex h-full flex-col p-7">
      {/* Logo */}
      <Link href="/" className="mb-5 flex shrink-0 items-center gap-2 text-background">
        <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="5" fill="currentColor" fillOpacity="0.12" />
          <path d="M7 12H17M12 7V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-xl font-semibold">fitCRM</span>
      </Link>

      {/* Sliding track */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-background/10 shadow-2xl">

        {/* Track — all slides in a row */}
        <div
          className="flex h-full"
          style={{
            width: `${slides.length * 100}%`,
            transform: `translateX(-${idx * (100 / slides.length)}%)`,
            transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {slides.map((s) => (
            <div key={s.badge} className="relative h-full" style={{ width: `${100 / slides.length}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.badge}
                className="absolute inset-0 size-full object-cover object-left-top"
              />
            </div>
          ))}
        </div>

        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-b from-transparent to-foreground" />
      </div>

      {/* Text — fades on slide change */}
      <div className="mt-5 transition-opacity duration-200" style={{ opacity: textVisible ? 1 : 0 }}>
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 text-xs font-medium text-background/75">
          <div className="size-1.5 rounded-full bg-background/60" />
          {slide.badge}
        </div>
        <h2 className="mb-2 whitespace-pre-line text-2xl font-bold leading-tight text-background">
          {slide.title}
        </h2>
        <p className="text-sm leading-6 text-background/50">
          {slide.desc}
        </p>
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (i !== idx) goTo(i) }}
            aria-label={`Показать слайд ${i + 1}`}
            aria-current={i === idx ? "true" : undefined}
            className={`rounded-full transition-all duration-300 ${i === idx ? "h-2 w-6 bg-background" : "size-2 bg-background/20 hover:bg-background/50"}`}
          />
        ))}
      </div>
    </div>
  )
}
