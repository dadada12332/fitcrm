"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Quote, Star } from "lucide-react"

type Review = {
  quote: string
  role: string
  location: string
  initials: string
  tone: string
}

const slides = [
  {
    badge: "Аналитика",
    title: "Полная картина\nвашего клуба",
    desc: "Выручка, посещения и ключевые метрики в реальном времени. ИИ-аналитика подскажет, что улучшить.",
    reviews: [
      {
        quote: "Теперь за пару минут понимаю, как прошёл день и где клуб теряет деньги.",
        role: "Владелец фитнес-клуба",
        location: "Ташкент",
        initials: "В",
        tone: "bg-brand",
      },
      {
        quote: "Отчёты больше не собираем вручную — вся картина уже перед глазами.",
        role: "Управляющая студией",
        location: "Самарканд",
        initials: "У",
        tone: "bg-chart-4",
      },
    ] satisfies Review[],
  },
  {
    badge: "Операции",
    title: "Весь день клуба\nв одном окне",
    desc: "Расписание, чекины, продления и оплаты появляются там, где команда работает прямо сейчас.",
    reviews: [
      {
        quote: "Администратор видит всё сразу: кто пришёл, кто оплатил и кому пора написать.",
        role: "Администратор клуба",
        location: "Ташкент",
        initials: "А",
        tone: "bg-chart-2",
      },
      {
        quote: "После перехода на FitCRM в расписании стало меньше накладок и пропущенных оплат.",
        role: "Руководитель студии",
        location: "Бухара",
        initials: "Р",
        tone: "bg-chart-3",
      },
    ] satisfies Review[],
  },
  {
    badge: "Команда",
    title: "Команда работает\nкак единое целое",
    desc: "Сотрудники, роли, смены и задачи собраны в понятном рабочем пространстве без лишних таблиц.",
    reviews: [
      {
        quote: "У каждого сотрудника своя зона ответственности, а у меня — полный контроль.",
        role: "Владелец сети клубов",
        location: "Ташкент",
        initials: "В",
        tone: "bg-brand",
      },
      {
        quote: "Новые администраторы быстро включаются в работу — интерфейс понятен с первого дня.",
        role: "Операционный менеджер",
        location: "Фергана",
        initials: "О",
        tone: "bg-chart-4",
      },
    ] satisfies Review[],
  },
]

function ReviewCard({
  review,
  direction,
}: {
  review: Review
  direction: 1 | -1
}) {
  return (
    <motion.article
      className="relative border-t border-background/20 px-2 py-5 text-background"
      initial={{
        opacity: 0,
        x: 48 * direction,
        y: 18,
        scale: 0.96,
        filter: "blur(7px)",
      }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        x: -36 * direction,
        y: -10,
        scale: 0.95,
        filter: "blur(5px)",
      }}
      transition={{
        duration: 0.5,
        delay: 0.42,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-lg shadow-foreground/10 ${review.tone}`}>
          {review.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-0.5 text-chart-4">
            {Array.from({ length: 5 }).map((_, starIndex) => (
              <Star key={starIndex} className="size-3.5" fill="currentColor" strokeWidth={1.5} />
            ))}
          </div>
          <blockquote className="pr-10 text-sm font-medium leading-[1.55] text-background/90 xl:text-[15px]">
            «{review.quote}»
          </blockquote>
          <p className="mt-3 text-xs text-background/50">
            <span className="font-semibold text-background/75">{review.role}</span>
            {" · "}
            {review.location}
          </p>
        </div>
      </div>
      <Quote className="absolute right-2 top-5 size-8 text-background/25" fill="currentColor" strokeWidth={1.5} />
    </motion.article>
  )
}

export function BrandingCarousel() {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const activeIndex = useRef(0)

  const goTo = useCallback((nextIndex: number, nextDirection?: 1 | -1) => {
    if (nextIndex === activeIndex.current) return
    setDirection(nextDirection ?? (nextIndex > activeIndex.current ? 1 : -1))
    activeIndex.current = nextIndex
    setIdx(nextIndex)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      goTo((activeIndex.current + 1) % slides.length, 1)
    }, 5600)
    return () => clearTimeout(timer)
  }, [goTo, idx])

  const slide = slides[idx]

  return (
    <div className="flex h-full min-h-0 flex-col p-7">
      <Link href="/" className="flex shrink-0 items-center gap-2 text-background">
        <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="5" fill="currentColor" fillOpacity="0.12" />
          <path d="M7 12H17M12 7V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-xl font-semibold">fitCRM</span>
      </Link>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={slide.badge}
            className="absolute inset-0 flex min-h-0 flex-col pt-6 xl:pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, filter: "blur(5px)" }}
              transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 text-xs font-medium text-background/75">
                <span className="size-1.5 rounded-full bg-background/60" />
                {slide.badge}
              </div>
              <h2 className="mb-2.5 whitespace-pre-line text-3xl font-bold leading-[1.08] text-background xl:text-4xl">
                {slide.title}
              </h2>
              <p className="max-w-[94%] text-sm leading-5 text-background/70 xl:text-base xl:leading-6">
                {slide.desc}
              </p>
            </motion.div>

            <div className="mt-9 xl:mt-12">
              {slide.reviews.map((review) => (
                <ReviewCard
                  key={`${slide.badge}-${review.role}`}
                  review={review}
                  direction={direction}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2">
        {slides.map((item, index) => (
          <motion.button
            key={item.badge}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Показать слайд ${index + 1}`}
            aria-current={index === idx ? "true" : undefined}
            className={`h-2 rounded-full transition-colors ${index === idx ? "bg-background" : "bg-background/20 hover:bg-background/50"}`}
            animate={{ width: index === idx ? 24 : 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        ))}
      </div>
    </div>
  )
}
