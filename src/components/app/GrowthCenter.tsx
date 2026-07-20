"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CalendarCheck2, CircleDollarSign, Gauge, Sparkles, TrendingDown, TrendingUp, UsersRound } from "lucide-react"
import { GrowthExperiments } from "@/components/app/GrowthExperiments"
import { GrowthPlaybooks } from "@/components/app/GrowthPlaybooks"
import { GrowthSimulator } from "@/components/app/GrowthSimulator"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import type { GrowthData, GrowthExperimentRun, GrowthPlaybook } from "@/lib/growth"

const formatMoney = (value: number) => `${value.toLocaleString("ru-RU")} сум`
const formatTrend = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}%`
const PRIORITY_META = {
  critical: { label: "Срочно", variant: "destructive" as const },
  high: { label: "Сегодня", variant: "secondary" as const },
  medium: { label: "Следом", variant: "outline" as const },
}

export function GrowthCenter({ data, initialRuns }: { data: GrowthData; initialRuns: GrowthExperimentRun[] }) {
  const [tab, setTab] = useState("today")
  const [preferredPlaybook, setPreferredPlaybook] = useState<GrowthPlaybook["id"] | null>(null)
  const [runs, setRuns] = useState(initialRuns)
  const updateRun = (run: GrowthExperimentRun) => setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)])
  const openAction = (destination: "playbooks" | "experiments", playbookId?: GrowthPlaybook["id"]) => {
    if (destination === "experiments") {
      setTab("experiments")
      return
    }
    setPreferredPlaybook(playbookId ?? null)
    setTab("playbooks")
  }
  const trendCards = [
    { label: "Выручка 30 дней", value: formatMoney(data.metrics.revenue30), hint: formatTrend(data.metrics.revenueTrendPct), positive: data.metrics.revenueTrendPct >= 0, icon: CircleDollarSign },
    { label: "Динамика посещений", value: formatTrend(data.metrics.attendanceTrendPct), hint: "к предыдущим 7 дням", positive: data.metrics.attendanceTrendPct >= 0, icon: UsersRound },
    { label: "Потенциал возврата", value: formatMoney(data.metrics.retentionValue), hint: "удержание и долги", positive: true, icon: Sparkles },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-0.144px] text-foreground">Growth OS</h1><Badge variant="secondary">Lab</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">Ежедневный план роста: от сигнала и гипотезы до следующего действия и оценки эффекта</p>
        </div>
        <Link href="/retention" className={buttonVariants({ variant: "outline" })}>Открыть удержание <ArrowRight data-icon="inline-end" /></Link>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_repeat(3,minmax(0,1fr))]">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary-foreground/20 text-xl font-semibold tabular-nums">{data.health.score}</div>
            <div><p className="flex items-center gap-1.5 text-xs opacity-70"><Gauge className="size-3.5" /> Пульс клуба</p><p className="mt-1 text-lg font-semibold">{data.health.label}</p><p className="mt-1 text-xs leading-5 opacity-70">{data.health.explanation}</p></div>
          </CardContent>
        </Card>
        {trendCards.map(({ label, value, hint, positive, icon: Icon }) => (
          <Card key={label} size="sm"><CardContent><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><Icon className="size-4 text-muted-foreground" /></div><p className="mt-3 break-words text-lg font-semibold tabular-nums text-foreground">{value}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{hint}</p></CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <div className="overflow-x-auto pb-1"><TabsList className="min-w-max"><TabsTab value="today">Сегодня</TabsTab><TabsTab value="simulator">Симулятор</TabsTab><TabsTab value="playbooks">Сценарии</TabsTab><TabsTab value="experiments">Эксперименты</TabsTab></TabsList></div>
        <TabsPanel value="today" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="size-4 text-muted-foreground" /> План на сегодня</CardTitle><CardDescription>Очередь автоматически собрана по срочности и денежному потенциалу. Начните сверху.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {data.dailyPlan.map((action, index) => (
                <div key={action.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums text-foreground">{index + 1}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{action.title}</p><Badge variant={PRIORITY_META[action.priority].variant}>{PRIORITY_META[action.priority].label}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p></div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="text-sm font-semibold tabular-nums text-foreground">{action.count} клиентов</p><p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{action.value > 0 ? formatMoney(action.value) : "Рост активности"}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => openAction(action.destination, action.playbookId)} aria-label={`Открыть внутри Growth OS: ${action.title}`}><ArrowRight /></Button></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsPanel>
        <TabsPanel value="simulator" className="mt-4"><GrowthSimulator pools={data.pools} /></TabsPanel>
        <TabsPanel value="playbooks" className="mt-4">{preferredPlaybook && <p className="mb-3 text-xs text-muted-foreground">Выбранный эксперимент использует playbook: <span className="font-medium text-foreground">{data.playbooks.find((item) => item.id === preferredPlaybook)?.title}</span></p>}<GrowthPlaybooks playbooks={data.playbooks} /></TabsPanel>
        <TabsPanel value="experiments" className="mt-4"><GrowthExperiments experiments={data.experiments} playbooks={data.playbooks} runs={runs} onRunChange={updateRun} /></TabsPanel>
      </Tabs>
    </div>
  )
}
