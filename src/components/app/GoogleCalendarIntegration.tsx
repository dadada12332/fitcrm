"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import {
  disconnectGoogleCalendarAction,
  startGoogleCalendarOAuthAction,
  syncGoogleCalendarAction,
} from "@/app/(app)/integrations/google-calendar/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { showActionError } from "@/lib/plan-limit-client"

export type GoogleCalendarPageData = {
  configured: boolean
  connected: boolean
  email: string | null
  displayName: string | null
  status: string | null
  lastSyncedAt: string | null
  lastError: string | null
  lastItems: number
  syncWindowDays: number
}

function date(value: string | null) {
  if (!value) return "Ещё не синхронизировано"
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
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
  const [message, setMessage] = useState<string | null>(
    oauth === "connected"
      ? "Google Calendar подключён, расписание синхронизировано"
      : oauth && oauth !== "cancelled"
        ? "Подключение не завершено. Проверьте настройки Google Cloud"
        : null,
  )

  const connect = () => startTransition(async () => {
    setMessage(null)
    const result = await startGoogleCalendarOAuthAction()
    if (result.error) {
      setMessage(result.error)
      showActionError(result.error)
      return
    }
    if (result.url) window.location.assign(result.url)
  })

  const sync = () => startTransition(async () => {
    setMessage(null)
    const result = await syncGoogleCalendarAction()
    setMessage(result.error ?? `Синхронизировано занятий: ${result.items ?? 0}`)
    if (!result.error) router.refresh()
  })

  const disconnect = () => startTransition(async () => {
    if (!window.confirm("Отключить Google Calendar? FitCRM также удалит созданные им будущие события.")) return
    const result = await disconnectGoogleCalendarAction()
    setMessage(result.error ?? "Google Calendar отключён")
    if (!result.error) router.refresh()
  })

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Интеграции
        </Link>
        {data.connected && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={sync} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Синхронизировать
            </Button>
            <Button
              variant="destructive"
              size="icon"
              aria-label="Отключить Google Calendar"
              title="Отключить Google Calendar"
              onClick={disconnect}
              disabled={pending}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-chart-1 text-primary-foreground">
          <CalendarDays className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Google Calendar</h1>
            <Badge variant={data.connected ? "secondary" : "outline"}>
              {data.connected ? <><CheckCircle2 />Подключено</> : "Не подключено"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Расписание клуба в основном календаре Google
          </p>
        </div>
      </div>

      {(message || data.lastError) && (
        <div className={`flex gap-2 rounded-lg border p-3 text-sm ${
          data.lastError
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : "border-border bg-muted/50 text-foreground"
        }`}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message ?? data.lastError}</span>
        </div>
      )}

      {!data.connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Подключите календарь клуба</CardTitle>
            <CardDescription>
              FitCRM создаёт и обновляет только свои события в основном календаре выбранного
              Google-аккаунта. Остальные события не изменяются.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!data.configured && (
              <div className="border-l-2 border-primary bg-muted/50 px-4 py-3">
                <p className="font-medium text-foreground">Google OAuth ещё не настроен</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Нужны OAuth Client ID и Client Secret веб-приложения с включённым Google Calendar API.
                </p>
              </div>
            )}
            <div className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ["Без дублей", "Одно занятие FitCRM всегда соответствует одному событию Google"],
                ["Актуальные изменения", "Время, тренер и зал обновляются при повторной синхронизации"],
                ["Безопасный доступ", "Refresh token зашифрован и никогда не отправляется в браузер"],
              ].map(([title, description]) => (
                <div key={title} className="py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                  <ShieldCheck className="size-5 text-primary" />
                  <p className="mt-3 font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
            <Button size="lg" onClick={connect} disabled={pending || !data.configured}>
              {pending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
              Подключить Google Calendar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-5 pt-0 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Google-аккаунт</p>
              <p className="mt-1 truncate font-semibold text-foreground">
                {data.email || data.displayName || "Google Calendar"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Последняя синхронизация</p>
              <p className="mt-1 text-sm text-foreground">{date(data.lastSyncedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Последний результат</p>
              <p className="mt-1 text-sm text-foreground">
                {data.lastItems} занятий · ближайшие {data.syncWindowDays} дней
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

