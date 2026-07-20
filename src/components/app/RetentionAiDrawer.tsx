"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  Copy,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { RetentionAiAnalysis, RetentionAiPriority } from "@/lib/retention-ai"

const LEVEL_LABELS = { critical: "Критический", high: "Высокий", medium: "Средний" } as const
const CONFIDENCE_LABELS = { high: "Высокая", medium: "Средняя", low: "Низкая" } as const

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

function PriorityItem({ item }: { item: RetentionAiPriority }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [])

  async function copyDraft() {
    await navigator.clipboard.writeText(item.messageDraft)
    setCopied(true)
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopied(false), 1800)
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Черновик сообщения</p>
          <Button type="button" variant="ghost" size="sm" onClick={copyDraft}>
            {copied ? <Check /> : <Copy />} {copied ? "Скопировано" : "Копировать"}
          </Button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.messageDraft}</p>
      </div>
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  analysis: RetentionAiAnalysis | null
  pending: boolean
  error: string | null
  onRetry: () => void
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
                  {analysis.priorities.map((priority) => <PriorityItem key={priority.clientId} item={priority} />)}
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
