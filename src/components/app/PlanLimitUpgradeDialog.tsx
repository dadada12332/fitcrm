"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowRight, Check, Gauge, Loader2, Sparkles } from "lucide-react"
import { getPlanUpgradeRecommendationAction, type PlanUpgradeOffer } from "@/app/(app)/plan-upgrade-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PLAN_LIMIT_EVENT } from "@/lib/plan-limit-client"
import type { PlanLimitDetails } from "@/lib/plan-limits"

function money(value: number, currency: string): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ${currency === "UZS" ? "сум" : currency}`
}

function period(value: string): string {
  if (value === "yearly") return "в год"
  if (value === "quarterly") return "за квартал"
  return "в месяц"
}

export function PlanLimitUpgradeDialog() {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<PlanLimitDetails | null>(null)
  const [offer, setOffer] = useState<PlanUpgradeOffer | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const onLimit = (event: Event) => {
      const next = (event as CustomEvent<PlanLimitDetails>).detail
      setDetails(next)
      setOffer(null)
      setOpen(true)
      startTransition(async () => {
        const result = await getPlanUpgradeRecommendationAction(next.key)
        setOffer(result.offer ?? null)
      })
    }
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit)
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit)
  }, [])

  const upgradeHref = offer ? "/settings/subscription" : "/support"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="border-b border-border bg-muted/40 px-6 py-5">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">Тариф {details?.planName ?? "текущий"}</p>
              <p className="text-sm leading-5 text-muted-foreground">Использовано всё доступное количество</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <DialogHeader className="pr-8 pt-1">
            <DialogTitle className="text-xl text-foreground">
              Лимит «{details?.label ?? "ресурса"}» достигнут
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Данные клуба в безопасности. Увеличьте лимит и продолжайте работу без удаления клиентов или настроек.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 border-y border-border py-5">
            {pending ? (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Подбираем подходящий тариф
              </div>
            ) : offer ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Sparkles className="size-4" /> Рекомендуем {offer.name}</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {money(offer.price, offer.currency)} <span className="text-sm font-normal text-muted-foreground">{period(offer.period)}</span>
                    </p>
                  </div>
                  {offer.oldPrice && offer.oldPrice > offer.price && (
                    <p className="text-sm text-muted-foreground line-through">{money(offer.oldPrice, offer.currency)}</p>
                  )}
                </div>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {offer.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3" /></span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="min-h-24">
                <p className="font-medium text-foreground">Нужен индивидуальный объём?</p>
                <p className="mt-1 text-sm text-muted-foreground">Мы подберём лимиты под размер клуба и поможем перейти без остановки работы.</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <Button nativeButton={false} className="h-12 flex-1 px-5 text-sm font-semibold" render={<Link href={upgradeHref} onClick={() => setOpen(false)} />}>
              {offer ? <>Перейти на {offer.name}<ArrowRight /></> : <>Связаться с поддержкой<ArrowRight /></>}
            </Button>
            <Button variant="ghost" className="h-10" onClick={() => setOpen(false)}>Остаться пока</Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Переход на новый тариф не меняет и не удаляет данные клуба.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
