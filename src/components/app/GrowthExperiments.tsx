"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  Beaker,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  ContactRound,
  Flag,
  Play,
  SquareChartGantt,
  Target,
  X,
} from "lucide-react"
import {
  cancelGrowthExperimentAction,
  completeGrowthExperimentAction,
  startGrowthExperimentAction,
} from "@/app/(app)/growth/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { GrowthExperiment, GrowthExperimentRun, GrowthPlaybook } from "@/lib/growth"

type Props = {
  experiments: GrowthExperiment[]
  playbooks: GrowthPlaybook[]
  runs: GrowthExperimentRun[]
  onRunChange: (run: GrowthExperimentRun) => void
}

const RESULT_OPTIONS = [
  { value: "won" as const, label: "Сработало", icon: CheckCircle2 },
  { value: "inconclusive" as const, label: "Без изменений", icon: SquareChartGantt },
  { value: "lost" as const, label: "Не сработало", icon: X },
]

const RESULT_LABELS: Record<NonNullable<GrowthExperimentRun["result"]>, string> = {
  won: "Сработало",
  inconclusive: "Без изменений",
  lost: "Не сработало",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value))
}

function pluralize(value: number, one: string, few: string, many: string) {
  const mod100 = value % 100
  const mod10 = value % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

const formatDays = (value: number) => `${value} ${pluralize(value, "день", "дня", "дней")}`
const formatClients = (value: number) => `${value} ${pluralize(value, "клиент", "клиента", "клиентов")}`

export function GrowthExperiments({ experiments, playbooks, runs, onRunChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = experiments.find((item) => item.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3">
        {[
          { icon: Beaker, step: "1", title: "Настройте", text: "Проверьте гипотезу и текст" },
          { icon: ContactRound, step: "2", title: "Выполните", text: "Свяжитесь с аудиторией" },
          { icon: Flag, step: "3", title: "Зафиксируйте", text: "Запишите результат теста" },
        ].map(({ icon: Icon, step, title, text }) => (
          <div key={step} className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-sm"><Icon className="size-4" /></div>
            <div><p className="text-sm font-medium text-foreground">{step}. {title}</p><p className="mt-0.5 text-xs text-muted-foreground">{text}</p></div>
          </div>
        ))}
      </div>

      <div id="experiments" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {experiments.map((experiment) => {
          const activeRun = runs.find((run) => run.experimentKey === experiment.id && run.status === "active")
          const completedRun = runs.find((run) => run.experimentKey === experiment.id && run.status === "completed")
          return (
            <Card key={experiment.id} className="transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-sm">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Beaker className="size-4" /></div>
                  {activeRun ? <Badge variant="secondary">В работе · до {formatDate(activeRun.endsAt)}</Badge> : completedRun ? <Badge variant="outline">{completedRun.result ? RESULT_LABELS[completedRun.result] : "Завершён"}</Badge> : <Badge variant="outline">{experiment.expectedImpact}</Badge>}
                </div>
                <CardTitle>{experiment.title}</CardTitle>
                <CardDescription>{experiment.hypothesis}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><Target className="size-3.5" /> Метрика</p><p className="mt-2 font-medium text-foreground">{experiment.metric}</p></div>
                  <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" /> Срок</p><p className="mt-2 font-medium text-foreground">{formatDays(experiment.durationDays)}</p></div>
                </div>
                <Button type="button" variant={activeRun ? "secondary" : "outline"} className="w-full" onClick={() => setSelectedId(experiment.id)}>
                  {activeRun ? <Play data-icon="inline-start" /> : <SquareChartGantt data-icon="inline-start" />}
                  {activeRun ? "Продолжить работу" : completedRun ? "Посмотреть результат" : "Настроить эксперимент"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ExperimentDrawer
        key={selectedId ?? "closed"}
        experiment={selected}
        playbook={selected ? playbooks.find((item) => item.id === selected.playbookId) ?? null : null}
        runs={runs}
        open={selected !== null}
        onOpenChange={(open) => { if (!open) setSelectedId(null) }}
        onRunChange={onRunChange}
      />
    </div>
  )
}

function ExperimentDrawer({
  experiment,
  playbook,
  runs,
  open,
  onOpenChange,
  onRunChange,
}: {
  experiment: GrowthExperiment | null
  playbook: GrowthPlaybook | null
  runs: GrowthExperimentRun[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRunChange: (run: GrowthExperimentRun) => void
}) {
  const activeRun = experiment ? runs.find((run) => run.experimentKey === experiment.id && run.status === "active") ?? null : null
  const completedRun = experiment ? runs.find((run) => run.experimentKey === experiment.id && run.status === "completed") ?? null : null
  const displayRun = activeRun ?? completedRun
  const [message, setMessage] = useState(activeRun?.message ?? playbook?.message ?? "")
  const [result, setResult] = useState<"won" | "inconclusive" | "lost">(completedRun?.result ?? "won")
  const [resultValue, setResultValue] = useState(completedRun?.resultValue ?? "")
  const [note, setNote] = useState(completedRun?.resultNote ?? "")
  const [now] = useState(() => Date.now())
  const [pending, startTransition] = useTransition()
  const daysLeft = activeRun ? Math.min(activeRun.durationDays, Math.max(0, Math.ceil((new Date(activeRun.endsAt).getTime() - now) / 86_400_000))) : 0
  const audienceDestination = experiment?.playbookId === "onboarding" ? "/clients" : "/retention"

  const startTime = activeRun ? new Date(activeRun.startedAt).getTime() : now
  const endTime = activeRun ? new Date(activeRun.endsAt).getTime() : now
  const progress = activeRun ? Math.min(100, Math.max(0, ((now - startTime) / Math.max(1, endTime - startTime)) * 100)) : 0

  if (!experiment || !playbook) return null

  const launch = () => startTransition(async () => {
    const response = await startGrowthExperimentAction({ experimentId: experiment.id, audienceSize: playbook.audience, message })
    if (response.error || !response.run) { toast.error(response.error ?? "Не удалось запустить эксперимент"); return }
    onRunChange(response.run)
    toast.success("Эксперимент запущен")
  })

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeRun?.message ?? message)
      toast.success("Текст скопирован. Откройте аудиторию и свяжитесь с клиентами")
    } catch {
      toast.error("Браузер не разрешил скопировать текст")
    }
  }

  const complete = () => {
    if (!activeRun) return
    startTransition(async () => {
      const response = await completeGrowthExperimentAction({ runId: activeRun.id, result, resultValue, note })
      if (response.error || !response.run) { toast.error(response.error ?? "Не удалось завершить эксперимент"); return }
      onRunChange(response.run)
      toast.success("Результат сохранён")
    })
  }

  const cancel = () => {
    if (!activeRun) return
    startTransition(async () => {
      const response = await cancelGrowthExperimentAction(activeRun.id)
      if (response.error || !response.run) { toast.error(response.error ?? "Не удалось отменить эксперимент"); return }
      onRunChange(response.run)
      onOpenChange(false)
      toast.success("Эксперимент остановлен")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[620px]">
        <SheetHeader className="h-auto min-h-16 gap-3 py-3">
          <div className="min-w-0"><SheetTitle className="truncate text-foreground">{experiment.title}</SheetTitle><p className="mt-1 text-xs text-muted-foreground">{activeRun ? `В работе · осталось ${daysLeft} дн.` : completedRun ? "Результат зафиксирован" : "Подготовка к запуску"}</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Закрыть"><X /></Button>
        </SheetHeader>

        <SheetBody className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            {["Настройка", "Контакт", "Результат"].map((label, index) => {
              const current = completedRun ? 3 : activeRun ? 2 : 1
              return <div key={label} className="min-w-0"><div className={cn("h-1.5 rounded-full", index < current ? "bg-primary" : "bg-muted")} /><p className="mt-2 truncate text-xs text-muted-foreground">{index + 1}. {label}</p></div>
            })}
          </div>

          <section>
            <p className="text-xs font-medium uppercase text-muted-foreground">Гипотеза</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{experiment.hypothesis}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Главная метрика</p><p className="mt-1 font-medium text-foreground">{experiment.metric}</p></div>
              <div><p className="text-xs text-muted-foreground">Ожидаемый эффект</p><p className="mt-1 font-medium text-foreground">{experiment.expectedImpact}</p></div>
              <div><p className="text-xs text-muted-foreground">Аудитория сейчас</p><p className="mt-1 font-medium text-foreground">{formatClients(playbook.audience)}</p></div>
              <div><p className="text-xs text-muted-foreground">Период теста</p><p className="mt-1 font-medium text-foreground">{formatDays(experiment.durationDays)}</p></div>
            </div>
          </section>

          {!displayRun && (
            <section className="space-y-3">
              <div><p className="text-sm font-medium text-foreground">Текст контакта</p><p className="mt-1 text-xs text-muted-foreground">Проверьте формулировку перед запуском. Её можно изменить под стиль клуба.</p></div>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} />
            </section>
          )}

          {activeRun && (
            <>
              <section>
                <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-medium text-foreground">Эксперимент выполняется</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(activeRun.startedAt)} — {formatDate(activeRun.endsAt)}</p></div><p className="text-sm font-semibold tabular-nums text-foreground">{Math.round(progress)}%</p></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
              </section>

              <section className="space-y-3">
                <div><p className="text-sm font-medium text-foreground">Свяжитесь с аудиторией</p><p className="mt-1 text-xs text-muted-foreground">Скопируйте текст для Telegram или используйте его как основу разговора по телефону.</p></div>
                <blockquote className="rounded-lg bg-muted p-4 text-sm leading-6 text-foreground">{activeRun.message}</blockquote>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={copyMessage}><Clipboard /> Скопировать текст</Button>
                  <Link href={audienceDestination} className={buttonVariants({ variant: "outline", className: "w-full" })}><ContactRound /> Открыть аудиторию</Link>
                </div>
              </section>

              <section className="space-y-3 border-t border-border pt-5">
                <div><p className="text-sm font-medium text-foreground">Зафиксировать результат</p><p className="mt-1 text-xs text-muted-foreground">Завершите тест, когда команда обработала аудиторию или срок эксперимента закончился.</p></div>
                <div className="grid grid-cols-3 gap-2">
                  {RESULT_OPTIONS.map(({ value, label, icon: Icon }) => <Button key={value} type="button" size="sm" variant={result === value ? "secondary" : "outline"} className="min-w-0 px-2" onClick={() => setResult(value)}><Icon /> <span className="truncate">{label}</span></Button>)}
                </div>
                <label className="block"><span className="text-xs font-medium text-muted-foreground">Значение метрики после теста</span><Input className="mt-2" value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder={experiment.metric} /></label>
                <label className="block"><span className="text-xs font-medium text-muted-foreground">Что заметили</span><Textarea className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Короткий вывод для следующего запуска" /></label>
                <Button type="button" className="w-full" disabled={pending} onClick={complete}><Flag /> {pending ? "Сохраняем..." : "Завершить и сохранить результат"}</Button>
                <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={pending} onClick={cancel}>Остановить без результата</Button>
              </section>
            </>
          )}

          {completedRun && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted p-4"><div className="flex size-9 items-center justify-center rounded-lg bg-background"><Check className="size-4" /></div><div><p className="text-sm font-medium text-foreground">{completedRun.result ? RESULT_LABELS[completedRun.result] : "Эксперимент завершён"}</p><p className="mt-0.5 text-xs text-muted-foreground">Завершён {completedRun.completedAt ? formatDate(completedRun.completedAt) : "—"}</p></div></div>
              <div><p className="text-xs text-muted-foreground">Итоговая метрика</p><p className="mt-1 text-sm font-medium text-foreground">{completedRun.resultValue || "Не указана"}</p></div>
              <div><p className="text-xs text-muted-foreground">Вывод команды</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{completedRun.resultNote || "Комментарий не добавлен"}</p></div>
            </section>
          )}
        </SheetBody>

        {!displayRun && (
          <SheetFooter className="h-auto min-h-20 py-4">
            <Button type="button" className="h-10 w-full" disabled={pending || !message.trim()} onClick={launch}><Play /> {pending ? "Запускаем..." : `Запустить на ${formatDays(experiment.durationDays)}`}</Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
