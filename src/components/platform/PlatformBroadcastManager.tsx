"use client"

import { useState, useTransition } from "react"
import { BellRing, CalendarClock, Send, XCircle } from "lucide-react"
import { toast } from "sonner"
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
import type { PlatformBroadcastRow } from "@/lib/platform"
import {
  cancelPlatformBroadcastAction,
  createPlatformBroadcastAction,
} from "@/app/platform/(protected)/broadcasts/actions"

const STATUS: Record<string, string> = {
  scheduled: "Запланирована",
  processing: "Публикуется",
  sent: "Опубликована",
  partial: "Опубликована частично",
  failed: "Ошибка",
  cancelled: "Отменена",
}

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Все клубы",
  "plan:trial": "Trial",
  "plan:starter": "Starter",
  "plan:standard": "Standard",
  "plan:business": "Business",
  "status:expired": "Подписка истекла",
  "status:suspended": "Приостановленные",
}

const CATEGORY_LABEL: Record<string, string> = {
  news: "Новость",
  maintenance: "Технические работы",
  update: "Обновление продукта",
  important: "Важное уведомление",
}

export function PlatformBroadcastManager({ broadcasts }: { broadcasts: PlatformBroadcastRow[] }) {
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState<PlatformBroadcastRow["category"]>("news")
  const [audience, setAudience] = useState("all")
  const [scheduledAt, setScheduledAt] = useState("")

  const submit = () => startTransition(async () => {
    const [kind, value] = audience.split(":")
    const result = await createPlatformBroadcastAction({
      title,
      body,
      category,
      audience: { kind: kind as "all" | "plan" | "status", value },
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(scheduledAt
      ? `Уведомление запланировано: ${result.recipients} получателей`
      : `Уведомление опубликовано: ${result.recipients} получателей`)
    setTitle("")
    setBody("")
    setScheduledAt("")
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section className="h-fit rounded-lg border border-border bg-card p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Новая рассылка</h2>
          <p className="mt-1 text-xs text-muted-foreground">Сообщение появится у владельцев в центре уведомлений CRM.</p>
        </div>
        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm font-medium text-foreground">Заголовок
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Обновление Zalkins" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">Тип уведомления
            <Select value={category} onValueChange={(value) => value && setCategory(value as PlatformBroadcastRow["category"])}>
              <SelectTrigger><SelectValue>{CATEGORY_LABEL[category]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="news">Новость</SelectItem>
                <SelectItem value="maintenance">Технические работы</SelectItem>
                <SelectItem value="update">Обновление продукта</SelectItem>
                <SelectItem value="important">Важное уведомление</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">Сообщение
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              rows={8}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Расскажите, что изменилось и что нужно сделать."
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">Аудитория
            <Select value={audience} onValueChange={(value) => value && setAudience(value)}>
              <SelectTrigger><SelectValue>{AUDIENCE_LABEL[audience] ?? audience}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все клубы</SelectItem>
                <SelectItem value="plan:trial">Trial</SelectItem>
                <SelectItem value="plan:starter">Starter</SelectItem>
                <SelectItem value="plan:standard">Standard</SelectItem>
                <SelectItem value="plan:business">Business</SelectItem>
                <SelectItem value="status:expired">Подписка истекла</SelectItem>
                <SelectItem value="status:suspended">Приостановленные</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">Когда отправить
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </label>
          <Button type="button" className="w-full" onClick={submit} disabled={pending}>
            <Send className="size-4" />{pending ? "Формируем очередь…" : scheduledAt ? "Запланировать" : "Отправить сейчас"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">История рассылок</h2>
        </div>
        {broadcasts.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <BellRing className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Рассылок пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{broadcast.title}</p>
                      <Badge variant="secondary">{STATUS[broadcast.status] ?? broadcast.status}</Badge>
                      <Badge variant="outline">{CATEGORY_LABEL[broadcast.category] ?? broadcast.category}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{broadcast.body}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{broadcast.readCount} прочитано · {broadcast.recipientCount} получателей</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />{new Date(broadcast.scheduledAt ?? broadcast.createdAt).toLocaleString("ru-RU")}</span>
                    </div>
                  </div>
                  {broadcast.status === "scheduled" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={pending}
                      aria-label="Отменить рассылку"
                      onClick={() => startTransition(async () => {
                        const result = await cancelPlatformBroadcastAction(broadcast.id)
                        if (result.error) toast.error(result.error)
                        else toast.success("Рассылка отменена")
                      })}
                    >
                      <XCircle className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
