"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  CalendarDays,
  ChartNoAxesCombined,
  MessagesSquare,
  Quote,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

type Review = {
  quote: string
  role: string
  location: string
  initials: string
  tone: string
  className: string
}

type Feature = {
  title: string
  desc: string
  icon: LucideIcon
  tone: string
}

const features = [
  {
    title: "Аналитика в реальном времени",
    desc: "Выручка, посещения и KPI клуба на одном экране",
    icon: ChartNoAxesCombined,
    tone: "bg-brand/15 text-brand",
  },
  {
    title: "Клиенты и абонементы",
    desc: "Клиентская база, абонементы и сроки продления",
    icon: UsersRound,
    tone: "bg-chart-2/15 text-chart-2",
  },
  {
    title: "Расписание и тренеры",
    desc: "Занятия, смены и управление тренерами",
    icon: CalendarDays,
    tone: "bg-chart-3/15 text-chart-3",
  },
  {
    title: "Интеграции",
    desc: "Telegram, Instagram, SMS и другие каналы",
    icon: MessagesSquare,
    tone: "bg-chart-4/15 text-chart-4",
  },
] satisfies Feature[]

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
        className: "mr-10 -rotate-1",
      },
      {
        quote: "Отчёты больше не собираем вручную — вся картина уже перед глазами.",
        role: "Управляющая студией",
        location: "Самарканд",
        initials: "У",
        tone: "bg-chart-4",
        className: "ml-12 rotate-1",
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
        className: "mr-6 rotate-1",
      },
      {
        quote: "После перехода на FitCRM в расписании стало меньше накладок и пропущенных оплат.",
        role: "Руководитель студии",
        location: "Бухара",
        initials: "Р",
        tone: "bg-chart-3",
        className: "ml-16 -rotate-1",
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
        className: "mr-12 -rotate-1",
      },
      {
        quote: "Новые администраторы быстро включаются в работу — интерфейс понятен с первого дня.",
        role: "Операционный менеджер",
        location: "Фергана",
        initials: "О",
        tone: "bg-chart-4",
        className: "ml-10 rotate-1",
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
      className="relative rounded-2xl bg-card/90 p-3.5 text-card-foreground shadow-2xl shadow-foreground/10 ring-1 ring-background/20 backdrop-blur-md"
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
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground ${review.tone}`}>
          {review.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-0.5 text-chart-4">
            {Array.from({ length: 5 }).map((_, starIndex) => (
              <Star key={starIndex} className="size-3" fill="currentColor" strokeWidth={1.5} />
            ))}
          </div>
          <blockquote className="pr-7 text-xs font-medium leading-[1.45] xl:text-[13px]">
            «{review.quote}»
          </blockquote>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <span className="font-semibold text-card-foreground">{review.role}</span>
            {" · "}
            {review.location}
          </p>
        </div>
      </div>
      <Quote className="absolute right-3.5 top-3.5 size-6 text-muted/80" fill="currentColor" strokeWidth={1.5} />
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

            <div className="mt-5 grid grid-cols-2 gap-3">
              {features.map((feature, featureIndex) => {
                const Icon = feature.icon
                return (
                  <motion.article
                    key={feature.title}
                    className="min-h-32 rounded-2xl bg-primary/45 p-4 text-background shadow-lg shadow-foreground/10 ring-1 ring-background/10 backdrop-blur-md"
                    initial={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(5px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, scale: 0.98, filter: "blur(4px)" }}
                    transition={{
                      duration: 0.42,
                      delay: 0.1 + featureIndex * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <span className={`mb-3 flex size-10 items-center justify-center rounded-xl ${feature.tone}`}>
                      <Icon className="size-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="text-[13px] font-semibold leading-[1.3] text-background xl:text-sm">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-[11px] leading-4 text-background/65 xl:text-xs">
                      {feature.desc}
                    </p>
                  </motion.article>
                )
              })}
            </div>

            <div className="mt-3.5">
              <ReviewCard
                key={`${slide.badge}-${slide.reviews[0].role}`}
                review={slide.reviews[0]}
                direction={direction}
              />
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
