"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  AlertCircle, ArrowLeft, BarChart3, Camera, CheckCircle2, ExternalLink, Heart,
  Loader2, MessageCircle, RefreshCw, ShieldCheck, Trash2, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { disconnectInstagramAction, startInstagramOAuthAction, syncInstagramAction } from "@/app/(app)/integrations/instagram/actions"

export type InstagramMediaItem = {
  id: string
  mediaType: string
  caption: string | null
  imageUrl: string | null
  permalink: string | null
  publishedAt: string | null
  likes: number
  comments: number
  insights: Record<string, unknown>
}

export type InstagramPageData = {
  configured: boolean
  connected: boolean
  username: string | null
  displayName: string | null
  accountType: string | null
  status: string | null
  followers: number
  mediaCount: number
  lastSyncedAt: string | null
  lastError: string | null
  media: InstagramMediaItem[]
  reach: number
  views: number
  crmLeads: number
  crmClients: number
  crmRevenue: number
}

function number(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value)
}

function date(value: string | null) {
  if (!value) return "Ещё не синхронизировано"
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function InstagramIntegration({ data, oauth }: { data: InstagramPageData; oauth?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(
    oauth === "connected" ? "Instagram подключён, первые данные загружены" :
      oauth && oauth !== "cancelled" ? "Подключение не завершено. Проверьте настройки Meta App" : null,
  )

  const connect = () => startTransition(async () => {
    setMessage(null)
    const result = await startInstagramOAuthAction()
    if (result.error) return setMessage(result.error)
    if (result.url) window.location.assign(result.url)
  })
  const sync = () => startTransition(async () => {
    setMessage(null)
    const result = await syncInstagramAction()
    setMessage(result.error ?? `Обновлено публикаций: ${result.items ?? 0}`)
    if (!result.error) router.refresh()
  })
  const disconnect = () => startTransition(async () => {
    if (!window.confirm("Отключить Instagram и удалить загруженные данные?")) return
    const result = await disconnectInstagramAction()
    setMessage(result.error ?? "Instagram отключён")
    if (!result.error) router.refresh()
  })

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Интеграции
        </Link>
        {data.connected && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={sync} disabled={pending}><RefreshCw />Обновить</Button>
            <Button variant="destructive" size="icon" aria-label="Отключить Instagram" title="Отключить Instagram" onClick={disconnect} disabled={pending}><Trash2 /></Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Camera className="size-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Instagram</h1>
            <Badge variant={data.connected ? "secondary" : "outline"}>
              {data.connected ? <><CheckCircle2 />Подключено</> : "Не подключено"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Контент, Insights и подтверждённая CRM-атрибуция клуба</p>
        </div>
      </div>

      {(message || data.lastError) && (
        <div className={`flex gap-2 rounded-lg border p-3 text-sm ${data.lastError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-foreground"}`}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message ?? data.lastError}</span>
        </div>
      )}

      {!data.connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Подключите профессиональный аккаунт</CardTitle>
            <CardDescription>FitCRM запросит доступ к профилю, публикациям, Insights, комментариям и сообщениям. Токен хранится зашифрованным и не доступен браузеру.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!data.configured && (
              <div className="border-l-2 border-primary bg-muted/50 px-4 py-3">
                <p className="font-medium text-foreground">Meta App ещё не настроено</p>
                <p className="mt-1 text-sm text-muted-foreground">Нужны Instagram App ID, App Secret, webhook verify token и одобренные permissions в Meta for Developers.</p>
              </div>
            )}
            <div className="grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-y divide-border">
              {[
                [BarChart3, "Публикации и Insights", "Охват, просмотры и вовлечение из API Instagram"],
                [Users, "Лиды и клиенты", "Отдельный учёт CRM-атрибуции без смешивания с охватом"],
                [ShieldCheck, "Контроль данных", "Отзыв доступа и data deletion callback Meta"],
              ].map(([Icon, title, description]) => (
                <div key={String(title)} className="py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                  <Icon className="size-5 text-primary" />
                  <p className="mt-3 font-medium text-foreground">{String(title)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(description)}</p>
                </div>
              ))}
            </div>
            <Button size="lg" onClick={connect} disabled={pending || !data.configured}>
              {pending ? <Loader2 className="animate-spin" /> : <Camera />}Подключить Instagram
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">@{data.username || "instagram"}</p>
                <p className="text-sm text-muted-foreground">{data.displayName || data.accountType || "Профессиональный аккаунт"}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground">Последняя синхронизация</p>
                <p className="mt-1 text-sm text-foreground">{date(data.lastSyncedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-foreground">Данные Instagram</h2>
              <p className="text-xs text-muted-foreground">Метрики, которые сообщает платформа Meta</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[["Подписчики", data.followers], ["Публикации", data.mediaCount], ["Охват", data.reach], ["Просмотры", data.views]].map(([label, value]) => (
                <Card key={String(label)} size="sm"><CardContent><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold text-foreground">{number(Number(value))}</p></CardContent></Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-foreground">Атрибуция FitCRM</h2>
              <p className="text-xs text-muted-foreground">Только переходы и оплаты, которые CRM смогла связать с Instagram</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[["Лиды", data.crmLeads], ["Стали клиентами", data.crmClients], ["Выручка", `${number(data.crmRevenue)} сум`]].map(([label, value]) => (
                <Card key={String(label)} size="sm"><CardContent><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold text-foreground">{value}</p></CardContent></Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-foreground">Последние публикации</h2>
              <p className="text-xs text-muted-foreground">До 50 последних posts и reels</p>
            </div>
            {data.media.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.media.map((item) => (
                  <Card key={item.id} size="sm">
                    {item.imageUrl ? <div className="relative aspect-square w-full"><Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover" /></div> : <div className="flex aspect-square items-center justify-center bg-muted"><Camera className="size-8 text-muted-foreground" /></div>}
                    <CardContent className="space-y-3">
                      <p className="line-clamp-2 min-h-10 text-sm text-foreground">{item.caption || "Без подписи"}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="size-3.5" />{number(item.likes)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{number(item.comments)}</span>
                        {item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" className="ml-auto hover:text-foreground" aria-label="Открыть публикацию"><ExternalLink className="size-4" /></a>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Публикации пока не загружены. Нажмите «Обновить».</CardContent></Card>}
          </section>
        </>
      )}
    </div>
  )
}
