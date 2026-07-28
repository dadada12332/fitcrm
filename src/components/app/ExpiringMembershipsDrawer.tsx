"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  Check,
  Copy,
  Phone,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { renewSubscriptionAction } from "@/app/(app)/clients/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { RetentionCandidate } from "@/lib/retention"
import { toast } from "@/lib/use-action"
import { useAppLocale } from "./ClubContext"

export type RetentionMembershipOption = {
  id: string
  name: string
  price: number
  durationDays: number
  visitsLimit: number | null
}

function dueLabel(daysLeft: number | null) {
  if (daysLeft === null) return "Дата не указана"
  if (daysLeft <= 0) return "Истекает сегодня"
  if (daysLeft === 1) return "Остался 1 день"
  if (daysLeft < 5) return `Осталось ${daysLeft} дня`
  return `Осталось ${daysLeft} дней`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Дата не указана"
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${value}T00:00:00`))
}

export function ExpiringMembershipsDrawer({
  open,
  onOpenChange,
  candidates,
  memberships,
  canExtend,
  onAnalyze,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: RetentionCandidate[]
  memberships: RetentionMembershipOption[]
  canExtend: boolean
  onAnalyze: (clientId: string) => void
}) {
  const { money } = useAppLocale()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [membershipId, setMembershipId] = useState("")
  const [processedIds, setProcessedIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const expiring = useMemo(
    () => candidates.filter((candidate) => (
      candidate.reasons.includes("expiring")
      && candidate.daysLeft !== null
      && candidate.daysLeft <= 7
      && !processedIds.includes(candidate.id)
    )),
    [candidates, processedIds],
  )

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru")
    if (!normalized) return expiring
    return expiring.filter((candidate) => (
      candidate.name.toLocaleLowerCase("ru").includes(normalized)
      || (candidate.phone ?? "").includes(normalized)
    ))
  }, [expiring, query])

  const selectedClient = expiring.find((candidate) => candidate.id === selectedClientId) ?? null
  const selectedMembership = memberships.find((membership) => membership.id === membershipId) ?? null
  const revenue = expiring.reduce((sum, candidate) => sum + candidate.estimatedValue, 0)

  function startRenewal(candidate: RetentionCandidate) {
    const currentMembership = memberships.find((membership) => membership.name === candidate.membership)
    setSelectedClientId(candidate.id)
    setMembershipId(currentMembership?.id ?? memberships[0]?.id ?? "")
  }

  function renew() {
    if (!selectedClient || !membershipId) return
    startTransition(async () => {
      const result = await renewSubscriptionAction(selectedClient.id, membershipId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setProcessedIds((current) => [...current, selectedClient.id])
      setSelectedClientId(null)
      setMembershipId("")
      toast.success(result.mode === "extend" ? "Абонемент продлён" : "Новый абонемент оформлен")
      router.refresh()
    })
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      toast.success("Номер скопирован")
    } catch {
      toast.error("Не удалось скопировать номер")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[620px]">
        <SheetHeader className="h-auto min-h-16 gap-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SheetTitle>Истекающие абонементы</SheetTitle>
              <Badge variant="secondary">{expiring.length}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Закройте продления, не покидая очередь удержания.</p>
          </div>
          <SheetClose
            render={<Button type="button" variant="ghost" size="icon" aria-label="Закрыть" />}
          >
            <X />
          </SheetClose>
        </SheetHeader>

        <SheetBody className="space-y-4 px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Нужно обработать</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{expiring.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Выручка в очереди</p>
              <p className="mt-1 truncate text-xl font-semibold tabular-nums text-foreground">{money(revenue)}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя или телефон"
              className="pl-9"
            />
          </div>

          {visible.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-background text-muted-foreground">
                <Check className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-foreground">
                {expiring.length === 0 ? "Все продления обработаны" : "Ничего не найдено"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {expiring.length === 0
                  ? "Очередь обновится, когда появятся новые абонементы со сроком до 7 дней."
                  : "Попробуйте изменить имя или номер телефона."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((candidate) => {
                const selected = selectedClientId === candidate.id
                return (
                  <div
                    key={candidate.id}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{candidate.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {candidate.membership ?? "Без абонемента"} · до {formatDate(candidate.expiresAt)}
                          </p>
                        </div>
                        <Badge variant={candidate.daysLeft !== null && candidate.daysLeft <= 3 ? "destructive" : "secondary"}>
                          {dueLabel(candidate.daysLeft)}
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startRenewal(candidate)}
                          disabled={!canExtend || memberships.length === 0}
                        >
                          <CalendarClock /> Продлить
                        </Button>
                        {candidate.phone && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              nativeButton={false}
                              render={<a href={`tel:${candidate.phone}`} />}
                            >
                              <Phone /> Позвонить
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Скопировать номер ${candidate.name}`}
                              onClick={() => copyPhone(candidate.phone!)}
                            >
                              <Copy />
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() => {
                            onOpenChange(false)
                            onAnalyze(candidate.id)
                          }}
                        >
                          <Sparkles /> AI-разбор
                        </Button>
                      </div>
                    </div>

                    {selected && selectedClient && (
                      <div className="space-y-3 border-t border-border bg-muted/30 p-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Оформить продление</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Выберите тариф — срок и посещения добавятся к текущему абонементу.
                          </p>
                        </div>
                        <Select value={membershipId} onValueChange={(value) => setMembershipId(value ?? "")}>
                          <SelectTrigger aria-label="Выберите абонемент">
                            <SelectValue placeholder="Выберите абонемент">
                              {selectedMembership
                                ? `${selectedMembership.name} · ${money(selectedMembership.price)}`
                                : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {memberships.map((membership) => (
                              <SelectItem key={membership.id} value={membership.id}>
                                <span className="flex w-full items-center justify-between gap-4">
                                  <span>{membership.name}</span>
                                  <span className="text-muted-foreground">{money(membership.price)}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedMembership && (
                          <p className="text-xs text-muted-foreground">
                            {selectedMembership.durationDays} дней
                            {selectedMembership.visitsLimit == null ? " · безлимитные посещения" : ` · ${selectedMembership.visitsLimit} посещений`}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setSelectedClientId(null)
                              setMembershipId("")
                            }}
                          >
                            Отмена
                          </Button>
                          <Button type="button" onClick={renew} disabled={pending || !membershipId}>
                            <Check /> {pending ? "Продлеваем…" : "Подтвердить"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!canExtend && (
            <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              У вашей роли нет права на продление абонементов. Позвонить клиенту и открыть AI-разбор можно без изменения тарифа.
            </p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
