"use client"

import { useMemo, useState } from "react"
import { Calculator, CircleDollarSign, RotateCcw, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateGrowthImpact, type GrowthPools, type GrowthScenario } from "@/lib/growth"

const DEFAULT_SCENARIO: GrowthScenario = { renewalRate: 30, winBackRate: 15, debtCollectionRate: 40, referralsPer100: 2 }
const formatMoney = (value: number) => `${value.toLocaleString("ru-RU")} сум`

type SliderProps = { label: string; value: number; max: number; suffix: string; onChange: (value: number) => void }

function ScenarioSlider({ label, value, max, suffix, onChange }: SliderProps) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}{suffix}</span>
      </span>
      <input type="range" min="0" max={max} value={value} onInput={(event) => onChange(Number(event.currentTarget.value))} className="h-2 w-full cursor-pointer accent-primary" />
    </label>
  )
}

export function GrowthSimulator({ pools }: { pools: GrowthPools }) {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO)
  const impact = useMemo(() => calculateGrowthImpact(pools, scenario), [pools, scenario])
  const update = (key: keyof GrowthScenario, value: number) => setScenario((current) => ({ ...current, [key]: value }))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader className="grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Что будет, если?</CardTitle>
            <CardDescription>Меняйте конверсии и сразу смотрите потенциальный эффект. Это сценарий, а не обещание.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setScenario(DEFAULT_SCENARIO)} aria-label="Сбросить сценарий"><RotateCcw /></Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScenarioSlider label="Продлим клиентов из зоны риска" value={scenario.renewalRate} max={100} suffix="%" onChange={(value) => update("renewalRate", value)} />
          <ScenarioSlider label="Вернём неактивных" value={scenario.winBackRate} max={100} suffix="%" onChange={(value) => update("winBackRate", value)} />
          <ScenarioSlider label="Соберём задолженность" value={scenario.debtCollectionRate} max={100} suffix="%" onChange={(value) => update("debtCollectionRate", value)} />
          <ScenarioSlider label="Рекомендаций на 100 клиентов" value={scenario.referralsPer100} max={20} suffix="" onChange={(value) => update("referralsPer100", value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="size-4 text-muted-foreground" /> Потенциал сценария</CardTitle>
          <CardDescription>Расчёт использует текущие пулы FitCRM и среднюю стоимость абонемента.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs opacity-70">Дополнительный денежный потенциал</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{formatMoney(impact.total)}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs opacity-70"><UsersRound className="size-3.5" /> Около {impact.recoveredClients} клиентов и рекомендаций</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Продления", impact.renewals], ["Возврат", impact.winBack], ["Задолженность", impact.debtCollection], ["Рекомендации", impact.referrals]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground"><CircleDollarSign className="size-4 text-muted-foreground" />{formatMoney(Number(value))}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
