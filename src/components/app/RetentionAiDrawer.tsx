"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Check,
  Copy,
  Database,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import {
  logRetentionOutreachAction,
  recordRetentionOutcomeAction,
  sendRetentionTelegramAction,
} from "@/app/(app)/retention/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { runAction, toast } from "@/lib/use-action"
import { cn } from "@/lib/utils"
import type { RetentionAiAnalysis, RetentionAiPriority } from "@/lib/retention-ai"

const LEVEL_LABELS = { critical: "Критический", high: "Высокий", medium: "Средний" } as const
const CONFIDENCE_LABELS = { high: "Высокая", medium: "Средняя", low: "Низкая" } as const
const STATUS_LABELS = { open: "Открыт", contacted: "Связались", follow_up: "Повторный контакт", won: "Возвращён", lost: "Закрыт" } as const
const OUTCOMES = [
  ["no_answer", "Не ответил"],
  ["interested", "Заинтересован"],
  ["renewing", "Продлевает"],
  ["returned", "Вернулся"],
  ["declined", "Отказался"],
  ["follow_up", "Связаться позже"],
] as const
const CHANNEL_LABELS = { telegram: "Telegram", phone: "Звонок", copy: "Копирование", system: "Система" } as const
const OUTCOME_LABELS: Record<string, string> = {
  sent: "отправлено",
  opened: "открыто",
  no_answer: "не ответил",
  interested: "заинтересован",
  renewing: "продлевает",
  returned: "вернулся",
  declined: "отказался",
  follow_up: "связаться позже",
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} сум`
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6" aria-label="AI анализирует данные">
      <div className="space-y-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
      {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-lg border border-border bg-muted/40" />)}
    </div>
  )
}

function tomorrowLocal() {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1000)
  value.setHours(10, 0, 0, 0)
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function formatInteractionDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement("textarea")
    textarea.value = value
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    textarea.remove()
    return copied
  }
}

function PriorityItem({ item, onRefresh }: { item: RetentionAiPriority; onRefresh: () => void }) {
  const [draft, setDraft] = useState(item.messageDraft)
  const [copied, setCopied] = useState(false)
  const [confirmTelegram, setConfirmTelegram] = useState(false)
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number][0] | null>(null)
  const [followUpAt, setFollowUpAt] = useState(tomorrowLocal)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  async function copyDraft() {
    if (!draft.trim()) return
    if (!await writeClipboard(draft)) {
      toast.error("Браузер не разрешил скопировать текст")
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
    setBusy(true)
    await runAction(() => logRetentionOutreachAction({ clientId: item.clientId, message: draft, channel: "copy" }), {
      success: "Текст скопирован, действие записано",
      onSuccess: onRefresh,
    })
    setBusy(false)
  }

  async function callClient() {
    if (!item.contact.phone || !draft.trim()) return
    setBusy(true)
    const result = await runAction(() => logRetentionOutreachAction({ clientId: item.clientId, message: draft, channel: "phone" }), {
      loading: "Записываем звонок…",
      success: "Звонок добавлен в историю",
      onSuccess: onRefresh,
    })
    setBusy(false)
    if (result && !result.error) window.location.href = `tel:${item.contact.phone}`
  }

  async function sendTelegram() {
    setBusy(true)
    await runAction(() => sendRetentionTelegramAction({ clientId: item.clientId, message: draft }), {
      loading: "Отправляем в Telegram…",
      success: "Сообщение отправлено",
      onSuccess: (result) => {
        setConfirmTelegram(false)
        if (result?.warning) toast.warning(result.warning)
        onRefresh()
      },
    })
    setBusy(false)
  }

  async function saveOutcome() {
    if (!outcome) return
    const needsDate = outcome === "follow_up" || outcome === "no_answer"
    const nextFollowUpAt = needsDate && followUpAt ? new Date(followUpAt).toISOString() : null
    setBusy(true)
    await runAction(() => recordRetentionOutcomeAction({ clientId: item.clientId, outcome, nextFollowUpAt, note }), {
      loading: "Сохраняем результат…",
      success: "Результат контакта сохранён",
      onSuccess: () => {
        setOutcome(null)
        setNote("")
        onRefresh()
      },
    })
    setBusy(false)
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-foreground">{item.name}</h4>
            <Badge variant={item.level === "critical" ? "destructive" : item.level === "high" ? "secondary" : "outline"}>
              {LEVEL_LABELS[item.level]} · {item.score}
            </Badge>
          </div>
          {item.estimatedValue > 0 && <p className="mt-1 text-xs text-muted-foreground">Потенциал {formatMoney(item.estimatedValue)}</p>}
        </div>
        <Link href={`/clients/${item.clientId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Карточка <ArrowRight data-icon="inline-end" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.facts.map((fact) => <Badge key={fact} variant="outline">{fact}</Badge>)}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Почему в приоритете</p>
          <p className="mt-1 text-foreground">{item.rationale}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Следующий шаг</p>
          <p className="mt-1 font-medium text-foreground">{item.nextAction}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-muted p-3">
        <label htmlFor={`retention-draft-${item.clientId}`} className="text-xs font-medium text-foreground">Сообщение клиенту</label>
        <Textarea
          id={`retention-draft-${item.clientId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-2 min-h-28 bg-background leading-6"
          maxLength={2000}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{draft.length}/2000</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button type="button" disabled={busy || !draft.trim() || !item.contact.telegramAvailable} onClick={() => setConfirmTelegram(true)}>
            <Send /> Telegram
          </Button>
          <Button type="button" variant="outline" disabled={busy || !draft.trim() || !item.contact.phone} onClick={callClient}>
            <Phone /> Позвонить
          </Button>
          <Button type="button" variant="outline" disabled={busy || !draft.trim()} onClick={copyDraft}>
            {copied ? <Check /> : <Copy />} {copied ? "Скопировано" : "Копировать"}
          </Button>
        </div>
        {!item.contact.telegramAvailable && <p className="mt-2 text-xs text-muted-foreground">Telegram: {item.contact.telegramReason}</p>}
        {!item.contact.phone && <p className="mt-1 text-xs text-muted-foreground">Телефон клиента не указан.</p>}

        {confirmTelegram && (
          <div className="mt-3 rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-medium text-foreground">Отправить это сообщение в Telegram?</p>
            <p className="mt-1 text-xs text-muted-foreground">После подтверждения клиент сразу получит текст через бота клуба.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmTelegram(false)}>Отмена</Button>
              <Button type="button" size="sm" disabled={busy} onClick={sendTelegram}><Send /> Отправить</Button>
            </div>
          </div>
        )}
      </div>

      {item.workflow && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Результат контакта</p>
            <Badge variant={item.workflow.status === "won" ? "secondary" : item.workflow.status === "lost" ? "outline" : "default"}>
              {STATUS_LABELS[item.workflow.status]}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {OUTCOMES.map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={outcome === value ? "secondary" : "outline"} onClick={() => {
                setOutcome(value)
                if (value === "follow_up" || value === "no_answer") setFollowUpAt(tomorrowLocal())
              }}>
                {label}
              </Button>
            ))}
          </div>
          {outcome && (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              {(outcome === "follow_up" || outcome === "no_answer") && (
                <div>
                  <label htmlFor={`follow-up-${item.clientId}`} className="text-xs font-medium text-foreground">Следующий контакт</label>
                  <Input id={`follow-up-${item.clientId}`} type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="mt-1" />
                </div>
              )}
              <div>
                <label htmlFor={`outcome-note-${item.clientId}`} className="text-xs font-medium text-foreground">Комментарий</label>
                <Input id={`outcome-note-${item.clientId}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Что обсудили" maxLength={500} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setOutcome(null)}>Отмена</Button>
                <Button type="button" size="sm" disabled={busy || ((outcome === "follow_up" || outcome === "no_answer") && !followUpAt)} onClick={saveOutcome}>Сохранить</Button>
              </div>
            </div>
          )}

          {item.workflow.interactions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">История</p>
              <div className="mt-2 divide-y divide-border rounded-lg border border-border">
                {item.workflow.interactions.map((interaction) => (
                  <div key={interaction.id} className="flex items-start justify-between gap-3 p-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{CHANNEL_LABELS[interaction.channel]}{interaction.outcome ? ` · ${OUTCOME_LABELS[interaction.outcome] ?? interaction.outcome}` : ""}</p>
                      {interaction.message && <p className="mt-1 line-clamp-2 text-muted-foreground">{interaction.message}</p>}
                    </div>
                    <div className="shrink-0 text-right text-muted-foreground">
                      <p>{formatInteractionDate(interaction.createdAt)}</p>
                      {interaction.staffName && <p className="mt-1">{interaction.staffName}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {item.workflow.nextFollowUpAt && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-4" />Следующий контакт: {formatInteractionDate(item.workflow.nextFollowUpAt)}</p>
          )}
        </div>
      )}
    </article>
  )
}

export function RetentionAiDrawer({
  open,
  onOpenChange,
  analysis,
  pending,
  error,
  onRetry,
  onRefresh,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  analysis: RetentionAiAnalysis | null
  pending: boolean
  error: string | null
  onRetry: () => void
  onRefresh: () => void
}) {
  const isClient = analysis?.scope.kind === "client"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[680px]">
        <SheetHeader className="h-auto min-h-20 gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"><BrainCircuit className="size-5" /></span>
            <div className="min-w-0">
              <SheetTitle>AI-разбор удержания</SheetTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{analysis?.title ?? "Анализируем актуальные данные CRM"}</p>
            </div>
          </div>
          <SheetClose className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Закрыть">
            <X className="size-4" />
          </SheetClose>
        </SheetHeader>

        <SheetBody className="px-4 sm:px-6">
          {pending && !analysis ? <AnalysisSkeleton /> : error ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <span className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertCircle className="size-6" /></span>
              <h3 className="mt-4 text-base font-semibold text-foreground">Не удалось выполнить разбор</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={onRetry}><RefreshCw /> Повторить</Button>
            </div>
          ) : analysis ? (
            <div className="space-y-7">
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary"><Sparkles /> {analysis.source === "ai" ? "AI-анализ" : "CRM-анализ"}</Badge>
                  <Badge variant="outline"><ShieldCheck /> Уверенность: {CONFIDENCE_LABELS[analysis.confidence]}</Badge>
                  {pending && <Badge variant="outline"><RefreshCw className="animate-spin" /> Обновление</Badge>}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{analysis.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
                <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><Database className="mt-0.5 size-3.5 shrink-0" />{analysis.confidenceNote}</p>
              </section>

              <section className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
                {[
                  ["В разборе", analysis.metrics.selected.toLocaleString("ru-RU")],
                  ["Критические", analysis.metrics.critical.toLocaleString("ru-RU")],
                  ["Под риском", formatMoney(analysis.metrics.revenueAtRisk)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 p-3 sm:p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 break-words text-base font-semibold tabular-nums text-foreground sm:text-lg">{value}</p>
                  </div>
                ))}
              </section>

              {!isClient && analysis.drivers.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground">Что создаёт риск</h3>
                  <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                    {analysis.drivers.map((driver) => (
                      <div key={driver.reason} className="p-3.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-foreground">{driver.label}</span>
                          <span className="tabular-nums text-muted-foreground">{driver.count} · {driver.share}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${driver.share}%` }} /></div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{driver.insight}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{isClient ? "Персональная рекомендация" : "Кого обработать первым"}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Факты загружены заново по внутреннему ID клиента.</p>
                  </div>
                  {!isClient && <Badge variant="outline">Топ {analysis.priorities.length}</Badge>}
                </div>
                <div className="mt-3 space-y-3">
                  {analysis.priorities.map((priority) => <PriorityItem key={priority.clientId} item={priority} onRefresh={onRefresh} />)}
                  {analysis.priorities.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">В выбранном сегменте нет клиентов для разбора.</p>}
                </div>
              </section>

              {!isClient && analysis.plan.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground">План на 7 дней</h3>
                  <div className="mt-3 space-y-0 border-l border-border pl-4">
                    {analysis.plan.map((item) => (
                      <div key={`${item.period}-${item.title}`} className="relative pb-5 last:pb-0">
                        <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-brand" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.period}</Badge>
                          <span className="text-xs text-muted-foreground">{item.count} клиентов</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-border bg-muted/40 p-3.5">
                <p className="text-xs font-medium text-foreground">Контроль действий</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {analysis.caveats.map((caveat) => <li key={caveat} className="flex gap-2"><span aria-hidden>•</span><span>{caveat}</span></li>)}
                </ul>
              </section>
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter className="h-auto min-h-20 justify-between px-4 py-3 sm:px-6">
          <p className="hidden text-xs text-muted-foreground sm:block">Никакие сообщения не отправляются автоматически</p>
          <SheetClose className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}>Закрыть</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
