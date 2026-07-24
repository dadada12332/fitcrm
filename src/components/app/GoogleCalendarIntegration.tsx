"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  UserRoundCheck,
} from "lucide-react"

import {
  createGoogleCalendarEventAction,
  disconnectGoogleCalendarAction,
  startGoogleCalendarOAuthAction,
  transferVisitsToGoogleCalendarAction,
} from "@/app/(app)/integrations/google-calendar/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { GoogleCalendarEventItem } from "@/lib/google-calendar"
import { cn } from "@/lib/utils"

export type GoogleCalendarPageData = {
  configured: boolean
  connected: boolean
  email: string | null
  displayName: string | null
  status: string | null
  lastSyncedAt: string | null
  lastError: string | null
  month: string
  events: GoogleCalendarEventItem[]
  eventsError: string | null
  visits: Array<{
    id: string
    clientName: string
    checkedInAt: string
    comment: string | null
    method: string | null
  }>
}

type Notice = { kind: "success" | "error"; text: string } | null

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function localDateInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value))
}

function formatEventTime(event: GoogleCalendarEventItem) {
  if (event.allDay) return "Весь день"
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(event.start))
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1))
}

function nextMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(year, monthNumber - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function calendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  const first = new Date(year, monthNumber - 1, 1)
  const leading = (first.getDay() + 6) % 7
  const days = new Date(year, monthNumber, 0).getDate()
  const previousDays = new Date(year, monthNumber - 1, 0).getDate()
  const total = Math.ceil((leading + days) / 7) * 7

  return Array.from({ length: total }, (_, index) => {
    const rawDay = index - leading + 1
    if (rawDay < 1) {
      const date = new Date(year, monthNumber - 2, previousDays + rawDay)
      return { date, outside: true }
    }
    if (rawDay > days) {
      const date = new Date(year, monthNumber, rawDay - days)
      return { date, outside: true }
    }
    return { date: new Date(year, monthNumber - 1, rawDay), outside: false }
  })
}

function eventDateKey(event: GoogleCalendarEventItem) {
  if (event.allDay) return event.start.slice(0, 10)
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tashkent",
  }).formatToParts(new Date(event.start))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

function eventTone(source: GoogleCalendarEventItem["source"]) {
  if (source === "fitcrm_visit") return "bg-chart-2/15 text-chart-2"
  if (source === "fitcrm_manual") return "bg-chart-3/15 text-chart-3"
  return "bg-chart-1/15 text-chart-1"
}

export function GoogleCalendarIntegration({ data, oauth }: { data: GoogleCalendarPageData; oauth?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(
    oauth === "connected"
      ? {
          kind: "success",
          text: "Google Calendar подключён. Ничего не перенесено — выберите нужные посещения вручную.",
        }
      : oauth === "error"
        ? {
            kind: "error",
            text: "Не удалось подключить Google Calendar. Попробуйте ещё раз.",
          }
        : null,
  )
  const [selectedVisits, setSelectedVisits] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(localDateInput())
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("11:00")

  const cells = useMemo(() => calendarCells(data.month), [data.month])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, GoogleCalendarEventItem[]>()
    for (const event of data.events) {
      const key = eventDateKey(event)
      grouped.set(key, [...(grouped.get(key) ?? []), event])
    }
    return grouped
  }, [data.events])

  function run(task: () => Promise<Notice>) {
    setNotice(null)
    startTransition(async () => {
      const result = await task()
      setNotice(result)
    })
  }

  function connect() {
    run(async () => {
      const result = await startGoogleCalendarOAuthAction()
      if (result.url) {
        window.location.assign(result.url)
        return null
      }
      return {
        kind: "error",
        text: result.error || "Не удалось открыть Google",
      }
    })
  }

  function disconnect() {
    run(async () => {
      const result = await disconnectGoogleCalendarAction()
      if (result.error) return { kind: "error", text: result.error }
      router.refresh()
      return { kind: "success", text: "Google Calendar отключён" }
    })
  }

  function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    run(async () => {
      const result = await createGoogleCalendarEventAction({
        title,
        description,
        date,
        startTime,
        endTime,
      })
      if (result.error) return { kind: "error", text: result.error }
      setTitle("")
      setDescription("")
      router.refresh()
      return { kind: "success", text: "Событие добавлено в Google Calendar" }
    })
  }

  function transferVisits() {
    run(async () => {
      const result = await transferVisitsToGoogleCalendarAction([...selectedVisits])
      if (result.error) return { kind: "error", text: result.error }
      setSelectedVisits(new Set())
      router.refresh()
      return {
        kind: "success",
        text: `Перенесено посещений: ${result.items ?? 0}`,
      }
    })
  }

  function changeMonth(delta: number) {
    router.push(`/integrations/google-calendar?month=${nextMonth(data.month, delta)}`)
  }

  if (!data.connected) {
    return (
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]">Google Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">События, заметки и выборочный перенос посещений</p>
        </header>

        <Card className="max-w-3xl">
          <CardHeader className="border-b border-border">
            <div className="flex size-10 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
              <CalendarDays className="size-5" aria-hidden />
            </div>
            <CardAction>
              <Badge variant="outline">
                <Clock3 aria-hidden />
                Не подключено
              </Badge>
            </CardAction>
            <CardTitle className="mt-3">Подключите рабочий календарь</CardTitle>
            <CardDescription className="max-w-2xl leading-6">
              Выберите аккаунт Google один раз. FitCRM ничего не переносит автоматически — вы сами решаете, какие
              события и посещения добавить.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                "События и заметки Google внутри CRM",
                "Новые события без перехода между сервисами",
                "Только выбранные посещения — без автосинхронизации",
              ].map((item) => (
                <div key={item} className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm leading-5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-2" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
              <Button className="w-full sm:w-auto" disabled={pending || !data.configured} onClick={connect}>
                {pending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
                Подключить Google Calendar
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">Ключи и секреты сотруднику не нужны</p>
            </div>
            {!data.configured && (
              <p className="mt-3 text-sm text-muted-foreground">
                Подключение временно недоступно: администратор FitCRM завершает настройку Google.
              </p>
            )}
            {notice && <NoticeView notice={notice} />}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex-1 space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-[-0.144px]">Google Calendar</h1>
                <Badge className="bg-chart-2 text-primary-foreground">
                  <CheckCircle2 aria-hidden />
                  Подключено
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{data.displayName || data.email || "Рабочий календарь"}</p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            События Google видны здесь. Новые события и посещения попадают в календарь только после вашего действия.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.refresh()} disabled={pending}>
            <RefreshCw />
            Обновить
          </Button>
          <Button variant="outline" onClick={disconnect} disabled={pending}>
            <LogOut />
            Отключить
          </Button>
        </div>
      </header>

      {notice && <NoticeView notice={notice} />}
      {data.eventsError && <NoticeView notice={{ kind: "error", text: data.eventsError }} />}

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-medium capitalize">{monthLabel(data.month)}</h2>
              <p className="text-xs text-muted-foreground">{data.events.length} событий</p>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}>
                <ArrowLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/integrations/google-calendar?month=${localDateInput().slice(0, 7)}`)}
              >
                Сегодня
              </Button>
              <Button variant="outline" size="icon" aria-label="Следующий месяц" onClick={() => changeMonth(1)}>
                <ArrowRight />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border/70">
            {cells.map(({ date: cellDate, outside }) => {
              const key = `${cellDate.getFullYear()}-${pad(cellDate.getMonth() + 1)}-${pad(cellDate.getDate())}`
              const dayEvents = eventsByDate.get(key) ?? []
              const today = key === localDateInput()
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-20 bg-card p-1.5 sm:min-h-24 sm:p-2",
                    outside && "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                      today && "bg-primary font-medium text-primary-foreground",
                    )}
                  >
                    {cellDate.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => {
                      const content = (
                        <>
                          <span className="hidden font-medium sm:inline">{formatEventTime(event)} </span>
                          <span className="truncate">{event.title}</span>
                        </>
                      )
                      const className = cn(
                        "flex w-full min-w-0 items-center rounded-md px-1.5 py-1 text-[10px] sm:text-xs",
                        eventTone(event.source),
                      )
                      return event.htmlLink ? (
                        <a
                          key={event.id}
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                          title={event.title}
                        >
                          {content}
                        </a>
                      ) : (
                        <div key={event.id} className={className} title={event.title}>
                          {content}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[10px] text-muted-foreground">ещё {dayEvents.length - 3}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-chart-3" aria-hidden />
              События и заметки
            </CardTitle>
            <CardDescription>Всё, что уже есть в выбранном месяце Google Calendar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[510px] space-y-2 overflow-y-auto pr-1">
              {data.events.length ? (
                data.events.map((event) => (
                  <article key={event.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="size-3" />
                          {event.allDay ? event.start : formatDateTime(event.start)}
                        </p>
                      </div>
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Открыть в Google Calendar"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </div>
                    {event.description && (
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{event.description}</p>
                    )}
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  В этом месяце пока нет событий
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={createEvent}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4 text-chart-1" aria-hidden />
                Новое событие
              </CardTitle>
              <CardDescription>Создайте встречу или заметку — она сразу появится в Google Calendar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Название</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например, созвон с тренером"
                  maxLength={120}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Заметка</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Детали, адрес или то, что важно не забыть"
                  maxLength={2000}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Дата</span>
                  <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Начало</span>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Конец</span>
                  <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                </label>
              </div>
              <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Добавить в Google Calendar
              </Button>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRoundCheck className="size-4 text-chart-2" aria-hidden />
              Перенести посещения
            </CardTitle>
            <CardDescription>Отметьте только нужные записи. Без выбора ничего не синхронизируется.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {data.visits.length ? (
                data.visits.map((visit) => {
                  const checked = selectedVisits.has(visit.id)
                  return (
                    <div
                      key={visit.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                        checked ? "border-primary/40 bg-primary/5" : "bg-background hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onClick={() => {
                          setSelectedVisits((current) => {
                            const next = new Set(current)
                            if (next.has(visit.id)) next.delete(visit.id)
                            else next.add(visit.id)
                            return next
                          })
                        }}
                        aria-label={`Выбрать посещение ${visit.clientName}`}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{visit.clientName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDateTime(visit.checkedInAt)}
                          {visit.method ? ` · ${visit.method}` : ""}
                        </span>
                        {visit.comment && (
                          <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">{visit.comment}</span>
                        )}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  За последние 30 дней посещений нет
                </div>
              )}
            </div>
            <Button
              size="lg"
              className="mt-4 h-10 w-full"
              disabled={pending || selectedVisits.size === 0}
              onClick={transferVisits}
            >
              {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              Перенести выбранные
              {selectedVisits.size > 0 ? ` · ${selectedVisits.size}` : ""}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function NoticeView({ notice }: { notice: Exclude<Notice, null> }) {
  return (
    <div
      className={cn(
        "mt-4 rounded-lg border px-4 py-3 text-sm",
        notice.kind === "success"
          ? "border-chart-2/30 bg-chart-2/10 text-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {notice.text}
    </div>
  )
}
