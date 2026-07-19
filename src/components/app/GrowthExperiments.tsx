"use client"

import { useState } from "react"
import { ArrowRight, Beaker, CalendarDays, CheckCircle2, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthExperiment } from "@/lib/growth"

export function GrowthExperiments({ experiments, onOpenPlaybook }: { experiments: GrowthExperiment[]; onOpenPlaybook: (id: GrowthExperiment["playbookId"]) => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div id="experiments" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {experiments.map((experiment) => (
        <Card key={experiment.id} className={selected === experiment.id ? "ring-2 ring-ring" : undefined}>
          <CardHeader>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Beaker className="size-4" /></div>
              <Badge variant="outline">{experiment.expectedImpact}</Badge>
            </div>
            <CardTitle>{experiment.title}</CardTitle>
            <CardDescription>{experiment.hypothesis}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><Target className="size-3.5" /> Метрика</p><p className="mt-2 font-medium text-foreground">{experiment.metric}</p></div>
              <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" /> Срок</p><p className="mt-2 font-medium text-foreground">{experiment.durationDays} дней</p></div>
            </div>
            <Button type="button" variant={selected === experiment.id ? "secondary" : "outline"} className="w-full" onClick={() => { setSelected(experiment.id); onOpenPlaybook(experiment.playbookId) }}>
              {selected === experiment.id ? <CheckCircle2 data-icon="inline-start" /> : null}
              {selected === experiment.id ? "Сценарий выбран" : "Открыть playbook"}<ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
