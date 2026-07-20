"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Search,
  ShieldAlert,
  Sparkles,
  UserRoundX,
  UsersRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RetentionAiDrawer } from "@/components/app/RetentionAiDrawer"
import { analyzeRetentionAction } from "@/app/(app)/retention/actions"
import type { RetentionCandidate, RetentionData, RetentionLevel, RetentionReason } from "@/lib/retention"
import type { RetentionAiAnalysis, RetentionAiFilter, RetentionAiScope } from "@/lib/retention-ai"

type Filter = RetentionAiFilter

const LEVEL_META: Record<RetentionLevel, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  critical: { label: "Критический", variant: "destructive" },
  high: { label: "Высокий", variant: "secondary" },
  medium: { label: "Средний", variant: "outline" },
}

const REASON_LABELS: Record<RetentionReason, string> = {
  expiring: "Скоро истекает",
  inactive: "Нет визитов",
  debt: "Есть долг",
  expired: "Недавно ушёл",
  frozen: "Заморожен",
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Все риски" },
  { value: "critical", label: "Критические" },
  { value: "expiring", label: "Продление" },
  { value: "inactive", label: "Неактивные" },
  { value: "debt", label: "Долги" },
  { value: "expired", label: "Возврат" },
]

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} сум`
}

function formatDate(value: string | null) {
  if (!value) return "Никогда"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function CandidateCard({ item, onAnalyze }: { item: RetentionCandidate; onAnalyze: (clientId: string) => void }) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <CardTitle className="truncate">{item.name}</CardTitle>
          <CardDescription className="mt-1 truncate">{item.membership ?? "Без абонемента"}</CardDescription>
        </div>
        <Badge variant={LEVEL_META[item.level].variant}>{LEVEL_META[item.level].label} · {item.score}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {item.reasons.map((reason) => <Badge key={reason} variant="outline">{REASON_LABELS[reason]}</Badge>)}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Последний визит</p>
            <p className="mt-1 font-medium text-foreground">{formatDate(item.lastVisit)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Потенциал</p>
            <p className="mt-1 font-medium text-foreground">{item.estimatedValue ? formatMoney(item.estimatedValue) : "Не рассчитан"}</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Следующий шаг: </span>{item.recommendedAction}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => onAnalyze(item.id)}><Sparkles /> AI-разбор</Button>
          <Link href={`/clients/${item.id}`} className={buttonVariants({ variant: "outline" })}>
            Клиент <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function RetentionCenter({ data }: { data: RetentionData }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [aiOpen, setAiOpen] = useState(false)
  const [aiScope, setAiScope] = useState<RetentionAiScope>({ kind: "portfolio", filter: "all" })
  const [aiAnalysis, setAiAnalysis] = useState<RetentionAiAnalysis | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPending, startAiTransition] = useTransition()
  const aiRequestId = useRef(0)

  function runAiAnalysis(scope: RetentionAiScope) {
    const requestId = ++aiRequestId.current
    setAiScope(scope)
    setAiAnalysis(null)
    setAiError(null)
    setAiOpen(true)
    startAiTransition(async () => {
      const result = await analyzeRetentionAction(scope)
      if (requestId !== aiRequestId.current) return
      setAiAnalysis(result.analysis ?? null)
      setAiError(result.error ?? null)
    })
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru")
    return data.candidates.filter((item) => {
      const filterMatches = filter === "all" || item.level === filter || item.reasons.includes(filter as RetentionReason)
      const searchMatches = !normalized || item.name.toLocaleLowerCase("ru").includes(normalized) || (item.phone ?? "").includes(normalized)
      return filterMatches && searchMatches
    })
  }, [data.candidates, filter, query])

  const stats = [
    { label: "В зоне риска", value: data.summary.atRisk.toLocaleString("ru-RU"), hint: "клиентов требуют внимания", icon: UsersRound },
    { label: "Срочно", value: data.summary.critical.toLocaleString("ru-RU"), hint: "совпало несколько сигналов", icon: ShieldAlert },
    { label: "Нет визитов 14+", value: data.summary.inactive14.toLocaleString("ru-RU"), hint: "или ещё не было посещений", icon: UserRoundX },
    { label: "Выручка под риском", value: formatMoney(data.summary.revenueAtRisk), hint: "по стоимости текущих тарифов", icon: CircleDollarSign },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.144px] text-foreground">Удержание</h1>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Клиенты с риском оттока, приоритет действий и выручка, которую ещё можно сохранить</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/clients?status=expiring" className={buttonVariants({ variant: "outline" })}>
            <CalendarClock data-icon="inline-start" /> Истекающие
          </Link>
          <Button type="button" onClick={() => runAiAnalysis({ kind: "portfolio", filter })}>
            <Sparkles /> Разобрать с AI
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label} size="sm">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 break-words text-xl font-semibold tabular-nums text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.summary.expiring7 > 0 && (
        <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">{data.summary.expiring7} клиентов нужно обработать до окончания абонемента</p>
            <p className="mt-1 text-xs text-muted-foreground">Продление до даты окончания обычно проще, чем возвращение уже ушедшего клиента.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Очередь удержания</CardTitle>
          <CardDescription>Скоринг детерминированный: срок абонемента, посещаемость, задолженность и недавнее истечение.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя или телефон" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <Button key={item.value} type="button" size="sm" variant={filter === item.value ? "secondary" : "ghost"} onClick={() => setFilter(item.value)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
              <Clock3 className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">По выбранному фильтру клиентов нет</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">Измените фильтр или поисковый запрос. Новые сигналы появятся автоматически из посещений, абонементов и оплат.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {filtered.map((item) => <CandidateCard key={item.id} item={item} onAnalyze={(clientId) => runAiAnalysis({ kind: "client", clientId })} />)}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Клиент</th>
                      <th className="px-4 py-3 font-medium">Риск</th>
                      <th className="px-4 py-3 font-medium">Сигналы</th>
                      <th className="px-4 py-3 font-medium">Последний визит</th>
                      <th className="px-4 py-3 font-medium">Выручка</th>
                      <th className="px-4 py-3 font-medium"><span className="sr-only">Действие</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((item) => (
                      <tr key={item.id} className="bg-card hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.membership ?? "Без абонемента"}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant={LEVEL_META[item.level].variant}>{LEVEL_META[item.level].label} · {item.score}</Badge></td>
                        <td className="px-4 py-3"><div className="flex max-w-xs flex-wrap gap-1">{item.reasons.map((reason) => <Badge key={reason} variant="outline">{REASON_LABELS[reason]}</Badge>)}</div></td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(item.lastVisit)}</td>
                        <td className="px-4 py-3 font-medium tabular-nums text-foreground">{item.estimatedValue ? formatMoney(item.estimatedValue) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => runAiAnalysis({ kind: "client", clientId: item.id })}><Sparkles /> AI-разбор</Button>
                            <Link href={`/clients/${item.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Открыть ${item.name}`}><ArrowRight /></Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <RetentionAiDrawer
        open={aiOpen}
        onOpenChange={setAiOpen}
        analysis={aiAnalysis}
        pending={aiPending}
        error={aiError}
        onRetry={() => runAiAnalysis(aiScope)}
      />
    </div>
  )
}
