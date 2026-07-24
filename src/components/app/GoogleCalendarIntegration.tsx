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
import { Button } from "@/components/ui/button"
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
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

function eventTone(source: GoogleCalendarEventItem["source"]) {
  if (source === "fitcrm_visit") return "bg-chart-2/15 text-chart-2"
  if (source === "fitcrm_manual") return "bg-chart-3/15 text-chart-3"
  return "bg-chart-1/15 text-chart-1"
}

export function GoogleCalendarIntegration({
  data,
  oauth,
}: {
  data: GoogleCalendarPageData
  oauth?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(
    oauth === "connected"
      ? {
          kind: "success",
          text: "Google Calendar подключён. Ничего не перенесено — выберите нужные посещения вручную.",
        }
      : oauth === "error"
        ? { kind: "error", text: "Не удалось подключить Google Calendar. Попробуйте ещё раз." }
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
      return { kind: "error", text: result.error || "Не удалось открыть Google" }
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
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6">
        <section className="w-full overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 sm:p-10">
              <div className="mb-7 flex size-14 items-center justify-center rounded-2xl bg-chart-1/15 text-chart-1">
                <CalendarDays className="size-7" />
              </div>
              <p className="mb-2 text-sm font-medium text-brand">Google Calendar</p>
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Календарь и заметки внутри FitCRM
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                Выберите рабочий аккаунт Google один раз. После подключения события не
                переносятся автоматически — вы сами решаете, что добавить в календарь.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Просмотр событий и заметок Google",
                  "Создание новых событий прямо из CRM",
                  "Выборочный перенос посещений без автосинхронизации",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="size-4 text-chart-2" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center border-t bg-muted/35 p-7 sm:p-10 lg:border-l lg:border-t-0">
              <h2 className="text-xl font-semibold">Подключить аккаунт</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Сотруднику не нужны ключи или секреты. Нажмите кнопку и выберите аккаунт Google.
              </p>
              <Button
                size="lg"
                className="mt-6 h-11 w-full"
                disabled={pending || !data.configured}
                onClick={connect}
              >
                {pending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
                Продолжить через Google
              </Button>
              {!data.configured && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Подключение временно недоступно: администратор FitCRM завершает настройку Google.
                </p>
              )}
              {notice && <NoticeView notice={notice} />}
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="flex-1 space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-chart-1/15 text-chart-1">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Google Calendar</h1>
              <p className="text-sm text-muted-foreground">
                {data.displayName || data.email || "Рабочий календарь"} · подключено
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            События Google видны здесь. Новые события и посещения попадают в календарь
            только после вашего действия.
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
      {data.eventsError && (
        <NoticeView notice={{ kind: "error", text: data.eventsError }} />
      )}

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-lg font-semibold capitalize">{monthLabel(data.month)}</h2>
              <p className="text-xs text-muted-foreground">{data.events.length} событий</p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Предыдущий месяц"
                onClick={() => changeMonth(-1)}
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/integrations/google-calendar?month=${localDateInput().slice(0, 7)}`)}
              >
                Сегодня
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Следующий месяц"
                onClick={() => changeMonth(1)}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b bg-muted/25">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map(({ date: cellDate, outside }) => {
              const key = `${cellDate.getFullYear()}-${pad(cellDate.getMonth() + 1)}-${pad(cellDate.getDate())}`
              const dayEvents = eventsByDate.get(key) ?? []
              const today = key === localDateInput()
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 border-b border-r p-1.5 sm:min-h-28 sm:p-2",
                    outside && "bg-muted/20 text-muted-foreground",
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
                      <p className="px-1 text-[10px] text-muted-foreground">
                        ещё {dayEvents.length - 3}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-chart-3" />
            <h2 className="font-semibold">События и заметки</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Всё, что уже есть в выбранном месяце Google Calendar.
          </p>
          <div className="mt-4 max-h-[590px] space-y-2 overflow-y-auto pr-1">
            {data.events.length ? (
              data.events.map((event) => (
                <article key={event.id} className="rounded-xl border bg-background p-3">
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
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                В этом месяце пока нет событий
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={createEvent} className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-chart-1" />
            <h2 className="text-lg font-semibold">Новое событие</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте встречу или заметку — она сразу появится в Google Calendar.
          </p>
          <div className="mt-5 space-y-4">
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
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                />
              </label>
            </div>
            <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Добавить в Google Calendar
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <UserRoundCheck className="size-4 text-chart-2" />
            <h2 className="text-lg font-semibold">Перенести посещения</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Отметьте только нужные записи. Без выбора ничего не синхронизируется.
          </p>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {data.visits.length ? (
              data.visits.map((visit) => {
                const checked = selectedVisits.has(visit.id)
                return (
                  <div
                    key={visit.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 transition-colors",
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
                        <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
                          {visit.comment}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
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
        </div>
      </section>
    </main>
  )
}

function NoticeView({ notice }: { notice: Exclude<Notice, null> }) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border px-4 py-3 text-sm",
        notice.kind === "success"
          ? "border-chart-2/30 bg-chart-2/10 text-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {notice.text}
    </div>
  )
}
