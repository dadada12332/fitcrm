"use client"

import { useState } from "react"
import { Check, Clipboard, MessageCircle, ShieldCheck, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthPlaybook } from "@/lib/growth"

export function GrowthPlaybooks({ playbooks }: { playbooks: GrowthPlaybook[] }) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(playbook: GrowthPlaybook) {
    await navigator.clipboard.writeText(playbook.message)
    setCopied(playbook.id)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Отправляет сотрудник</p>
          <p className="mt-1 text-xs text-muted-foreground">FitCRM готовит аудиторию и текст. Скопируйте его для Telegram или используйте как основу разговора по телефону.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {playbooks.map((playbook) => (
          <Card key={playbook.id}>
            <CardHeader className="grid-cols-[1fr_auto]">
              <div><CardTitle>{playbook.title}</CardTitle><CardDescription>{playbook.trigger}</CardDescription></div>
              <Badge variant={playbook.audience > 0 ? "secondary" : "outline"}>{playbook.audience} клиентов</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><MessageCircle className="size-3.5" /> {playbook.channel}</span>
                <span className="flex items-center gap-1.5"><UsersRound className="size-3.5" /> Готовая аудитория</span>
              </div>
              <blockquote className="rounded-xl bg-muted p-4 text-sm leading-6 text-foreground">{playbook.message}</blockquote>
              <Button type="button" variant="outline" className="w-full" onClick={() => copy(playbook)}>
                {copied === playbook.id ? <Check data-icon="inline-start" /> : <Clipboard data-icon="inline-start" />}
                {copied === playbook.id ? "Скопировано" : "Скопировать текст"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
