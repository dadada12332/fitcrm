"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, CreditCard, Sparkles, X } from "lucide-react"
import { completeProductTourAction, markTrialOfferSeenAction } from "@/app/(app)/product-onboarding-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ProductOnboardingData } from "@/lib/product-onboarding"

type Props = ProductOnboardingData & {
  onMobileSidebarChange: (open: boolean) => void
}

type TourStep = {
  selector: string | null
  eyebrow: string
  title: string
  text: string
}

type TargetRect = { top: number; left: number; right: number; bottom: number; width: number; height: number }

const TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    eyebrow: "Добро пожаловать в FitCRM",
    title: "Настроим ваш первый рабочий день",
    text: "За минуту покажем четыре места, с которых начинается ежедневная работа клуба.",
  },
  {
    selector: '[data-tour="quick-actions"]',
    eyebrow: "Шаг 1 из 4",
    title: "Главные операции всегда рядом",
    text: "Добавляйте клиента, принимайте оплату и отмечайте посещение из одного меню.",
  },
  {
    selector: '[data-tour="nav-clients"]',
    eyebrow: "Шаг 2 из 4",
    title: "Единая база клиентов",
    text: "Здесь находятся профили, контакты, история посещений, оплаты и абонементы каждого клиента.",
  },
  {
    selector: '[data-tour="nav-memberships"]',
    eyebrow: "Шаг 3 из 4",
    title: "Сначала создайте абонементы",
    text: "Настройте тарифы клуба один раз, а затем назначайте их клиентам и следите за продлениями.",
  },
  {
    selector: '[data-tour="nav-integrations"]',
    eyebrow: "Шаг 4 из 4",
    title: "Автоматизируйте общение",
    text: "Подключите Telegram-бота для рассылок, напоминаний, QR-пропуска и личного кабинета клиента.",
  },
]

const panelTransition = { type: "spring" as const, stiffness: 320, damping: 30 }

function formatPrice(value: number, currency: string) {
  const suffix = currency === "UZS" ? "сум" : currency
  return `${Math.round(value).toLocaleString("ru-RU")} ${suffix}`
}

function periodLabel(period: string) {
  return period === "yearly" ? "в год" : period === "quarterly" ? "в квартал" : "в месяц"
}

export function ProductOnboarding({
  showTour,
  trialOfferEligible,
  trialDaysLeft,
  offer,
  onMobileSidebarChange,
}: Props) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [tourPending, setTourPending] = useState(showTour)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [, startTransition] = useTransition()
  const step = TOUR_STEPS[stepIndex]
  const tourVisible = tourPending && pathname === "/dashboard"

  const finishTour = useCallback(() => {
    setTourPending(false)
    setTargetRect(null)
    onMobileSidebarChange(false)
    startTransition(async () => { await completeProductTourAction() })
  }, [onMobileSidebarChange])

  const nextStep = useCallback(() => {
    if (stepIndex === TOUR_STEPS.length - 1) finishTour()
    else setStepIndex((value) => value + 1)
  }, [finishTour, stepIndex])

  const syncTarget = useCallback(() => {
    if (!tourVisible || !step.selector) {
      setTargetRect(null)
      return
    }
    const element = document.querySelector<HTMLElement>(step.selector)
    if (!element) return
    const rect = element.getBoundingClientRect()
    const pad = 6
    const top = Math.max(8, rect.top - pad)
    const left = Math.max(8, rect.left - pad)
    const right = Math.min(window.innerWidth - 8, rect.right + pad)
    const bottom = Math.min(window.innerHeight - 8, rect.bottom + pad)
    setTargetRect({
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    })
  }, [step.selector, tourVisible])

  useEffect(() => {
    if (!tourVisible || !step.selector) return
    const mobile = window.innerWidth < 1024
    onMobileSidebarChange(mobile)
    const id = window.setTimeout(() => {
      document.querySelector<HTMLElement>(step.selector!)?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" })
      syncTarget()
    }, mobile ? 260 : 40)
    window.addEventListener("resize", syncTarget)
    window.addEventListener("scroll", syncTarget, true)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener("resize", syncTarget)
      window.removeEventListener("scroll", syncTarget, true)
    }
  }, [onMobileSidebarChange, reduceMotion, step.selector, syncTarget, tourVisible])

  useEffect(() => {
    if (!tourVisible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishTour()
      if (event.key === "ArrowRight") nextStep()
      if (event.key === "ArrowLeft" && stepIndex > 0) setStepIndex((value) => value - 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [finishTour, nextStep, stepIndex, tourVisible])

  useEffect(() => {
    if (!trialOfferEligible || !offer || tourPending || offerOpen) return
    const timer = window.setTimeout(() => {
      setOfferOpen(true)
      startTransition(async () => { await markTrialOfferSeenAction() })
    }, 10_000)
    return () => window.clearTimeout(timer)
  }, [offer, offerOpen, trialOfferEligible, tourPending])

  const panelStyle = useMemo(() => {
    if (!targetRect || typeof window === "undefined" || window.innerWidth < 768) return undefined
    const width = 360
    const left = targetRect.right + 16 + width <= window.innerWidth
      ? targetRect.right + 16
      : Math.max(16, targetRect.left - width - 16)
    return { left, top: Math.min(Math.max(16, targetRect.top), window.innerHeight - 310), width }
  }, [targetRect])

  return (
    <>
      <AnimatePresence>
        {tourVisible && (
          <motion.div
            className="fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
            role="dialog"
            aria-modal="true"
            aria-label="Знакомство с FitCRM"
          >
            {targetRect ? (
              <>
                <div className="fixed left-0 right-0 top-0 bg-zinc-950/60 backdrop-blur-[1px]" style={{ height: targetRect.top }} />
                <div className="fixed left-0 bg-zinc-950/60 backdrop-blur-[1px]" style={{ top: targetRect.top, width: targetRect.left, height: targetRect.height }} />
                <div className="fixed right-0 bg-zinc-950/60 backdrop-blur-[1px]" style={{ top: targetRect.top, left: targetRect.right, height: targetRect.height }} />
                <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/60 backdrop-blur-[1px]" style={{ top: targetRect.bottom }} />
                <motion.div
                  className="fixed rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
                  animate={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }}
                  transition={reduceMotion ? { duration: 0 } : panelTransition}
                />
                <div className="fixed" style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }} />
              </>
            ) : (
              <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-[2px]" />
            )}

            <AnimatePresence mode="wait">
              <motion.section
                key={stepIndex}
                className={cn(
                  "fixed z-[81] w-[calc(100%_-_2rem)] max-w-[360px] rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl",
                  !targetRect && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  targetRect && "bottom-4 left-4 md:bottom-auto md:left-auto",
                )}
                style={targetRect ? panelStyle : undefined}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={finishTour} aria-label="Пропустить знакомство">
                    <X />
                  </Button>
                </div>
                <p className="text-xs font-medium text-primary">{step.eyebrow}</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>

                <div className="mt-5 flex items-center gap-1.5" aria-label={`Шаг ${stepIndex + 1} из ${TOUR_STEPS.length}`}>
                  {TOUR_STEPS.map((item, index) => (
                    <span
                      key={item.title}
                      className={cn("h-1.5 rounded-full transition-all duration-300", index === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/25")}
                    />
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  {stepIndex === 0 ? (
                    <Button variant="ghost" onClick={finishTour}>Пропустить</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setStepIndex((value) => value - 1)}>
                      <ArrowLeft /> Назад
                    </Button>
                  )}
                  <Button onClick={nextStep}>
                    {stepIndex === TOUR_STEPS.length - 1 ? <><Check /> Готово</> : <>Далее <ArrowRight /></>}
                  </Button>
                </div>
              </motion.section>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0" showClose>
          <div className="border-b border-border bg-muted/40 px-6 py-5">
            <motion.div
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
              className="flex items-center gap-3"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary">Ваш клуб уже готов к работе</p>
                <p className="text-sm text-muted-foreground">В trial осталось {trialDaysLeft ?? 0} дн.</p>
              </div>
            </motion.div>
          </div>

          <div className="px-6 pb-6">
            <DialogHeader className="pt-1 pr-8">
              <DialogTitle className="text-xl text-foreground">Продолжайте расти без ограничений</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Сохраните доступ к клиентской базе, автоматизации и аналитике после окончания пробного периода.
              </DialogDescription>
            </DialogHeader>

            {offer && (
              <div className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Рекомендуем {offer.name}</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {formatPrice(offer.price, offer.currency)} <span className="text-sm font-normal text-muted-foreground">{periodLabel(offer.period)}</span>
                    </p>
                  </div>
                  {offer.oldPrice && offer.oldPrice > offer.price && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through">{formatPrice(offer.oldPrice, offer.currency)}</p>
                      <p className="text-xs font-medium text-primary">Экономия {Math.round(offer.oldPrice - offer.price).toLocaleString("ru-RU")} сум</p>
                    </div>
                  )}
                </div>

                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {offer.benefits.map((benefit, index) => (
                    <motion.li
                      key={benefit}
                      initial={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduceMotion ? 0 : 0.05 * index }}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3" /></span>
                      {benefit}
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                  <Button nativeButton={false} className="h-10 flex-1" render={<Link href="/settings?tab=subscription" onClick={() => setOfferOpen(false)} />}>
                    <CreditCard /> Выбрать тариф
                  </Button>
                  <Button variant="ghost" className="h-10" onClick={() => setOfferOpen(false)}>Напомнить позже</Button>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">Данные клуба сохранятся при переходе на платный тариф.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
