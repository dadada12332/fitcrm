"use client"

import { useMemo, useState, useTransition } from "react"
import { CalendarDays, Pencil, Plus, Power, TicketCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PlatformPromoRow } from "@/lib/platform"
import {
  savePlatformPromoAction,
  setPlatformPromoActiveAction,
  type PromoPayload,
} from "@/app/platform/(protected)/promo/actions"

const PLANS = [
  { code: "starter", label: "Starter" },
  { code: "standard", label: "Standard" },
  { code: "business", label: "Business" },
]

const emptyDraft: PromoPayload = {
  code: "",
  description: "",
  discountPct: null,
  freeDays: null,
  maxUses: null,
  startsAt: null,
  expiresAt: null,
  planCodes: [],
}

function toLocalDate(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function PromoManager({ promos }: { promos: PlatformPromoRow[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<PromoPayload>(emptyDraft)

  const activeCount = useMemo(() => promos.filter((promo) => promo.isActive).length, [promos])
  const openCreate = () => { setDraft(emptyDraft); setOpen(true) }
  const openEdit = (promo: PlatformPromoRow) => {
    setDraft({
      id: promo.id,
      code: promo.code,
      description: promo.description,
      discountPct: promo.discountPct,
      freeDays: promo.freeDays,
      maxUses: promo.maxUses,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
      planCodes: promo.planCodes,
    })
    setOpen(true)
  }
  const setNumber = (key: "discountPct" | "freeDays" | "maxUses", value: string) =>
    setDraft((current) => ({ ...current, [key]: value === "" ? null : Number(value) }))
  const togglePlan = (code: string) => setDraft((current) => ({
    ...current,
    planCodes: current.planCodes.includes(code)
      ? current.planCodes.filter((plan) => plan !== code)
      : [...current.planCodes, code],
  }))

  const submit = () => startTransition(async () => {
    const result = await savePlatformPromoAction(draft)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(draft.id ? "Промокод обновлён" : "Промокод создан")
    setOpen(false)
  })

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Активные</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Использований</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{promos.reduce((sum, promo) => sum + promo.usedCount, 0)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {promos.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <TicketCheck className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Промокодов пока нет</p>
            <p className="mt-1 text-xs text-muted-foreground">Создайте первый код для скидки или бесплатных дней.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {promos.map((promo) => {
              const exhausted = promo.maxUses != null && promo.usedCount >= promo.maxUses
              const expired = promo.expiresAt != null && new Date(promo.expiresAt) <= new Date()
              const active = promo.isActive && !exhausted && !expired
              return (
                <div key={promo.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">{promo.code}</span>
                      <Badge variant={active ? "secondary" : "outline"}>{active ? "Активен" : expired ? "Истёк" : exhausted ? "Лимит исчерпан" : "Архив"}</Badge>
                      {promo.discountPct && <Badge variant="outline">−{promo.discountPct}%</Badge>}
                      {promo.freeDays && <Badge variant="outline">+{promo.freeDays} дней</Badge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{promo.description || "Без описания"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{promo.usedCount} / {promo.maxUses ?? "∞"} использований</span>
                      <span>{promo.planCodes.length ? promo.planCodes.join(", ") : "Все тарифы"}</span>
                      {promo.expiresAt && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />до {new Date(promo.expiresAt).toLocaleDateString("ru-RU")}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(promo)}>
                      <Pencil className="size-4" />Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={pending}
                      aria-label={promo.isActive ? "Архивировать" : "Активировать"}
                      onClick={() => startTransition(async () => {
                        const result = await setPlatformPromoActiveAction(promo.id, !promo.isActive)
                        if (result.error) toast.error(result.error)
                        else toast.success(promo.isActive ? "Промокод архивирован" : "Промокод активирован")
                      })}
                    >
                      <Power className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Button type="button" className="mt-4" onClick={openCreate}><Plus className="size-4" />Создать промокод</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{draft.id ? "Изменить промокод" : "Новый промокод"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">Скидка применяется к заявке, бесплатные дни — к сроку подписки после подтверждения.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-foreground">Код
              <Input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="WELCOME20" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Описание
              <Input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Для новых клубов" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Скидка, %
              <Input type="number" min={1} max={100} value={draft.discountPct ?? ""} onChange={(event) => setNumber("discountPct", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Бесплатные дни
              <Input type="number" min={1} max={365} value={draft.freeDays ?? ""} onChange={(event) => setNumber("freeDays", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Лимит использований
              <Input type="number" min={1} value={draft.maxUses ?? ""} onChange={(event) => setNumber("maxUses", event.target.value)} placeholder="Без лимита" />
            </label>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Тарифы</p>
              <div className="flex h-10 items-center gap-2">
                {PLANS.map((plan) => (
                  <Button key={plan.code} type="button" size="sm" variant={draft.planCodes.includes(plan.code) ? "default" : "outline"} onClick={() => togglePlan(plan.code)}>
                    {plan.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Ничего не выбрано — действует на все.</p>
            </div>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Начало
              <Input type="datetime-local" value={toLocalDate(draft.startsAt)} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">Окончание
              <Input type="datetime-local" value={toLocalDate(draft.expiresAt)} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="button" onClick={submit} disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
