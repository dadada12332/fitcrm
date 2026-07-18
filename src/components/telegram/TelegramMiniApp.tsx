"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft, Bell, CalendarDays, Check, ChevronRight, Clock3, CreditCard, Dumbbell,
  History, Home, LoaderCircle, MapPin, QrCode, RefreshCw, TicketCheck, UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

type TelegramWebApp = {
  initData: string
  colorScheme: "light" | "dark"
  ready(): void
  expand(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  openLink(url: string): void
  BackButton?: {
    show(): void
    hide(): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
  }
  HapticFeedback?: { notificationOccurred(type: "success" | "error" | "warning"): void }
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

type Subscription = {
  id: string
  status: string
  starts_at: string
  expires_at: string | null
  visits_total: number | null
  visits_used: number
  memberships: { name: string; price: number } | Array<{ name: string; price: number }> | null
}

type ClassItem = {
  id: string
  title: string
  trainerName: string | null
  date: string
  startTime: string
  endTime: string | null
  roomName: string | null
  seatsTotal: number
  seatsBooked: number
  bookingId: string | null
}

type MiniAppData = {
  club: { name: string; city: string | null }
  client: { id: string; crmFullName: string; telegramName: string; telegramFirstName: string; telegramPhotoUrl: string | null }
  subscriptions: Subscription[]
  visits: Array<{ id: string; checked_in_at: string; method: string }>
  classes: ClassItem[]
  qrPass: string | null
  qrExpiresAt: string | null
  preferences: { expiry_reminders?: boolean; schedule_reminders?: boolean }
  providers: Array<"payme" | "click">
  serverDate: string
}

type Tab = "home" | "schedule" | "pass" | "profile"

const TABS: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "home", label: "Главная", icon: Home },
  { id: "schedule", label: "Занятия", icon: CalendarDays },
  { id: "pass", label: "Пропуск", icon: QrCode },
  { id: "profile", label: "Профиль", icon: UserRound },
]

function membershipOf(subscription?: Subscription | null) {
  if (!subscription?.memberships) return null
  return Array.isArray(subscription.memberships) ? subscription.memberships[0] ?? null : subscription.memberships
}

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`
}

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ru-RU", options ?? { day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00+05:00`))
}

function shortTime(time: string | null) {
  return time?.slice(0, 5) ?? ""
}

export function TelegramMiniApp({ clubId }: { clubId: string }) {
  const [tab, setTab] = useState<Tab>("home")
  const [data, setData] = useState<MiniAppData | null>(null)
  const [initData, setInitData] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<{ pass: string; url: string } | null>(null)
  const [qrSeconds, setQrSeconds] = useState(30)
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const tabStack = useRef<Tab[]>(["home"])
  const qrRefreshInFlight = useRef(false)

  const navigate = useCallback((nextTab: Tab) => {
    if (tab === nextTab) return
    setError(null)
    setNotice(null)
    tabStack.current = nextTab === "home" ? ["home"] : [...tabStack.current, nextTab]
    setTab(nextTab)
  }, [tab])

  const goBack = useCallback(() => {
    if (tab === "home") return
    tabStack.current = tabStack.current.slice(0, -1)
    const previousTab = tabStack.current.at(-1) ?? "home"
    if (!tabStack.current.length) tabStack.current = ["home"]
    setError(null)
    setNotice(null)
    setTab(previousTab)
  }, [tab])

  const api = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/telegram/miniapp/${clubId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, ...body }),
    })
    const result = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(String(result.error ?? "Не удалось выполнить действие"))
    return result
  }, [clubId, initData])

  const load = useCallback(async (telegramInitData: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/telegram/miniapp/${clubId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: telegramInitData, action: "bootstrap" }),
      })
      const result = await response.json() as MiniAppData & { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить кабинет")
      setData(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить кабинет")
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => {
    queueMicrotask(() => {
      if (new URLSearchParams(window.location.search).get("tab") === "pass") {
        tabStack.current = ["home", "pass"]
        setTab("pass")
      }
      const telegram = window.Telegram?.WebApp
      if (!telegram?.initData) {
        setError("Откройте личный кабинет через кнопку в Telegram-боте клуба")
        setLoading(false)
        return
      }
      document.documentElement.classList.toggle("dark", telegram.colorScheme === "dark")
      telegram.ready()
      telegram.expand()
      telegram.setHeaderColor("bg_color")
      telegram.setBackgroundColor("bg_color")
      setInitData(telegram.initData)
      void load(telegram.initData)
    })
  }, [load])

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton) return
    if (tab === "home") {
      backButton.hide()
      return
    }
    backButton.show()
    backButton.onClick(goBack)
    return () => backButton.offClick(goBack)
  }, [goBack, tab])

  useEffect(() => {
    if (!data?.qrPass) return
    const pass = data.qrPass
    let active = true
    void import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(pass, { width: 480, margin: 2 }))
      .then((url) => { if (active) setQrImage({ pass, url }) })
      .catch(() => { if (active) setQrImage(null) })
    return () => { active = false }
  }, [data?.qrPass])

  useEffect(() => {
    if (tab !== "pass" || !data?.qrExpiresAt) return
    let active = true
    const tick = async () => {
      const remaining = Math.max(0, Math.ceil((new Date(data.qrExpiresAt!).getTime() - Date.now()) / 1000))
      if (active) setQrSeconds(remaining)
      if (remaining > 0 || qrRefreshInFlight.current) return
      qrRefreshInFlight.current = true
      if (active) setQrRefreshing(true)
      try {
        const result = await api({ action: "qr" })
        if (!active) return
        setData((current) => current ? {
          ...current,
          qrPass: String(result.qrPass ?? ""),
          qrExpiresAt: String(result.qrExpiresAt ?? ""),
        } : current)
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "Не удалось обновить QR-код")
      } finally {
        qrRefreshInFlight.current = false
        if (active) setQrRefreshing(false)
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [api, data?.qrExpiresAt, tab])

  const activeSubscription = useMemo(() => data?.subscriptions.find((item) => item.status === "active")
    ?? data?.subscriptions[0] ?? null, [data?.subscriptions])

  async function mutate(action: "book" | "cancel", id: string) {
    setBusy(`${action}:${id}`)
    setError(null)
    setNotice(null)
    try {
      await api(action === "book" ? { action, classId: id } : { action, bookingId: id })
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success")
      setNotice(action === "book" ? "Вы записаны на занятие" : "Запись отменена")
      await load(initData)
    } catch (mutationError) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error")
      setError(mutationError instanceof Error ? mutationError.message : "Не удалось выполнить действие")
    } finally {
      setBusy(null)
    }
  }

  async function renew(provider: "payme" | "click") {
    setBusy(`renew:${provider}`)
    setError(null)
    try {
      const result = await api({ action: "renew", provider })
      const paymentUrl = String(result.paymentUrl ?? "")
      if (!paymentUrl) throw new Error("Платёжная ссылка не получена")
      const telegram = window.Telegram?.WebApp
      if (telegram) telegram.openLink(paymentUrl)
      else window.open(paymentUrl, "_blank", "noopener,noreferrer")
    } catch (renewError) {
      setError(renewError instanceof Error ? renewError.message : "Не удалось создать оплату")
    } finally {
      setBusy(null)
    }
  }

  async function updatePreference(key: "expiry_reminders" | "schedule_reminders", checked: boolean) {
    if (!data) return
    const preferences = { ...data.preferences, [key]: checked }
    setData({ ...data, preferences })
    try {
      await api({ action: "preferences", preferences })
      setNotice("Настройки сохранены")
    } catch (preferenceError) {
      setData({ ...data, preferences: { ...preferences, [key]: !checked } })
      setError(preferenceError instanceof Error ? preferenceError.message : "Не удалось сохранить настройки")
    }
  }

  if (loading) return <MiniAppLoading />
  if (!data) return <MiniAppError message={error ?? "Кабинет недоступен"} />

  return (
    <main className="min-h-[100dvh] bg-background text-foreground pb-[calc(76px+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-lg">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            {tab !== "home" && (
              <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Вернуться назад" title="Назад">
                <ArrowLeft />
              </Button>
            )}
            <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.club.name}</p>
            <p className="truncate text-xs text-muted-foreground">Личный кабинет</p>
            </div>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {data.client.telegramName.trim().charAt(0).toUpperCase()}
          </div>
        </header>

        {(error || notice) && (
          <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-sm ${error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-chart-2/30 bg-chart-2/10 text-foreground"}`}>
            {error ?? notice}
          </div>
        )}

        {tab === "home" && <HomeView data={data} subscription={activeSubscription} onTab={navigate} />}
        {tab === "schedule" && <ScheduleView classes={data.classes} busy={busy} onBook={(id) => mutate("book", id)} onCancel={(id) => mutate("cancel", id)} />}
        {tab === "pass" && <PassView data={data} qrUrl={qrSeconds > 0 && qrImage?.pass === data.qrPass ? qrImage.url : null} seconds={qrSeconds} refreshing={qrRefreshing} />}
        {tab === "profile" && (
          <ProfileView data={data} subscription={activeSubscription} busy={busy} onRenew={renew} onPreference={updatePreference} />
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-4">
          {TABS.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button key={item.id} type="button" onClick={() => navigate(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                <span className={`flex size-8 items-center justify-center rounded-lg ${active ? "bg-muted" : "bg-transparent"}`}><Icon size={18} /></span>
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </main>
  )
}

function HomeView({ data, subscription, onTab }: { data: MiniAppData; subscription: Subscription | null; onTab: (tab: Tab) => void }) {
  const membership = membershipOf(subscription)
  const visitsLeft = subscription?.visits_total == null ? null : Math.max(0, subscription.visits_total - subscription.visits_used)
  const next = data.classes.slice(0, 2)
  return (
    <div className="space-y-6 px-4 py-5">
      <section>
        <p className="text-sm text-muted-foreground">Добрый день,</p>
        <h1 className="mt-1 text-2xl font-semibold">{data.client.telegramFirstName}</h1>
      </section>

      <section className="rounded-lg bg-primary p-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs opacity-70">Текущий абонемент</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-primary-foreground">{membership?.name ?? "Нет активного абонемента"}</h2>
          </div>
          <TicketCheck className="shrink-0 opacity-80" size={24} />
        </div>
        {subscription && (
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-primary-foreground/20 pt-4">
            <div><p className="text-xs opacity-70">Действует до</p><p className="mt-1 text-sm font-medium">{subscription.expires_at ? formatDate(subscription.expires_at) : "Без срока"}</p></div>
            <div><p className="text-xs opacity-70">Посещения</p><p className="mt-1 text-sm font-medium">{visitsLeft == null ? "Безлимит" : `${visitsLeft} осталось`}</p></div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold">Быстрые действия</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <QuickAction icon={CalendarDays} label="Занятия" onClick={() => onTab("schedule")} />
          <QuickAction icon={QrCode} label="QR-пропуск" onClick={() => onTab("pass")} />
          <QuickAction icon={CreditCard} label="Продлить" onClick={() => onTab("profile")} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ближайшие занятия</h2>
          <button type="button" onClick={() => onTab("schedule")} className="flex items-center gap-1 text-xs text-brand">Все <ChevronRight size={14} /></button>
        </div>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {next.length ? next.map((item) => <CompactClass key={item.id} item={item} />) : <EmptyLine text="На ближайшую неделю занятий нет" />}
        </div>
      </section>
    </div>
  )
}

function ScheduleView({ classes, busy, onBook, onCancel }: { classes: ClassItem[]; busy: string | null; onBook: (id: string) => void; onCancel: (id: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, ClassItem[]>()
    for (const item of classes) map.set(item.date, [...(map.get(item.date) ?? []), item])
    return [...map.entries()]
  }, [classes])
  return (
    <div className="px-4 py-5">
      <h1 className="text-2xl font-semibold">Расписание</h1>
      <p className="mt-1 text-sm text-muted-foreground">Запись на ближайшие 7 дней</p>
      <div className="mt-6 space-y-6">
        {groups.length ? groups.map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-2 text-sm font-semibold capitalize">{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((item) => {
                const full = item.seatsTotal > 0 && item.seatsBooked >= item.seatsTotal
                const actionBusy = busy === `book:${item.id}` || busy === `cancel:${item.bookingId}`
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 shrink-0 text-sm font-semibold">{shortTime(item.startTime)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{[item.trainerName, item.roomName].filter(Boolean).join(" · ") || "Детали уточняются"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{item.seatsTotal > 0 ? `${Math.max(0, item.seatsTotal - item.seatsBooked)} мест свободно` : "Без ограничения мест"}</p>
                      </div>
                    </div>
                    <Button type="button" variant={item.bookingId ? "outline" : "default"} size="lg" className="mt-3 w-full"
                      disabled={actionBusy || (!item.bookingId && full)}
                      onClick={() => item.bookingId ? onCancel(item.bookingId) : onBook(item.id)}>
                      {actionBusy ? <LoaderCircle className="animate-spin" /> : item.bookingId ? <><Check />Вы записаны · Отменить</> : full ? "Мест нет" : "Записаться"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        )) : <EmptyState icon={CalendarDays} title="Занятий пока нет" text="Клуб ещё не опубликовал расписание на ближайшую неделю." />}
      </div>
    </div>
  )
}

function PassView({ data, qrUrl, seconds, refreshing }: { data: MiniAppData; qrUrl: string | null; seconds: number; refreshing: boolean }) {
  return (
    <div className="space-y-6 px-4 py-5">
      <div><h1 className="text-2xl font-semibold">QR-пропуск</h1><p className="mt-1 text-sm text-muted-foreground">Покажите код администратору на входе</p></div>
      {qrUrl ? (
        <section className="rounded-lg border border-border bg-card p-5 text-center">
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR-код клиента" className="block aspect-square h-auto w-full max-w-full" />
          </div>
          <p className="mt-4 font-medium">{data.client.telegramName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{refreshing ? "Обновляем код…" : `Новый код через ${seconds} сек.`}</p>
          <div className="mx-auto mt-3 h-1 w-full max-w-[280px] overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width] duration-1000" style={{ width: `${Math.max(0, Math.min(100, seconds / 30 * 100))}%` }} />
          </div>
        </section>
      ) : refreshing || seconds === 0
        ? <EmptyState icon={RefreshCw} title="Обновляем QR-код" text="Новый защищённый код появится через секунду." />
        : <EmptyState icon={QrCode} title="QR-вход недоступен" text="Клуб пока не включил вход по QR-коду." />}

      <section>
        <div className="flex items-center gap-2"><History size={17} /><h2 className="text-base font-semibold">Последние посещения</h2></div>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {data.visits.length ? data.visits.map((visit) => (
            <div key={visit.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div><p className="text-sm font-medium">{new Date(visit.checked_in_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</p><p className="text-xs text-muted-foreground">{new Date(visit.checked_in_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p></div>
              <span className="rounded-full bg-chart-2/10 px-2 py-1 text-xs text-chart-2">Посещение</span>
            </div>
          )) : <EmptyLine text="Посещений пока нет" />}
        </div>
      </section>
    </div>
  )
}

function ProfileView({ data, subscription, busy, onRenew, onPreference }: { data: MiniAppData; subscription: Subscription | null; busy: string | null; onRenew: (provider: "payme" | "click") => void; onPreference: (key: "expiry_reminders" | "schedule_reminders", checked: boolean) => void }) {
  const membership = membershipOf(subscription)
  return (
    <div className="space-y-6 px-4 py-5">
      <div><h1 className="text-2xl font-semibold">Профиль</h1><p className="mt-1 text-sm text-muted-foreground">{data.client.telegramName}</p></div>

      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Карточка в клубе</p>
        <p className="mt-1 font-medium">{data.client.crmFullName}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">ID {data.client.id.slice(0, 8)}</p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Продление</h2>
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-medium">{membership?.name ?? "Абонемент не выбран"}</p><p className="mt-1 text-sm text-muted-foreground">{membership ? formatMoney(Number(membership.price)) : "Обратитесь к администратору"}</p></div>
            <RefreshCw size={18} className="text-muted-foreground" />
          </div>
          {membership && data.providers.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {data.providers.map((provider) => (
                <Button key={provider} type="button" size="lg" variant={provider === "payme" ? "default" : "outline"}
                  disabled={busy === `renew:${provider}`} onClick={() => onRenew(provider)}>
                  {busy === `renew:${provider}` ? <LoaderCircle className="animate-spin" /> : <CreditCard />}{provider === "payme" ? "Payme" : "Click"}
                </Button>
              ))}
            </div>
          )}
          {membership && data.providers.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Онлайн-оплата пока не подключена клубом.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2"><Bell size={17} /><h2 className="text-base font-semibold">Напоминания</h2></div>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          <PreferenceRow label="Окончание абонемента" description="Сообщить заранее о продлении" checked={data.preferences.expiry_reminders !== false} onChange={(checked) => onPreference("expiry_reminders", checked)} />
          <PreferenceRow label="Занятия" description="Напомнить утром в день записи" checked={data.preferences.schedule_reminders !== false} onChange={(checked) => onPreference("schedule_reminders", checked)} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-muted-foreground" /><div><p className="font-medium">{data.club.name}</p><p className="mt-1 text-sm text-muted-foreground">{data.club.city || "Адрес уточните у администратора"}</p></div></div>
      </section>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-2 text-xs font-medium"><Icon size={21} /><span className="max-w-full truncate">{label}</span></button>
}

function CompactClass({ item }: { item: ClassItem }) {
  return <div className="flex items-center gap-3 px-4 py-3"><div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-xs font-semibold"><span>{shortTime(item.startTime)}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-muted-foreground">{formatDate(item.date)}{item.trainerName ? ` · ${item.trainerName}` : ""}</p></div>{item.bookingId && <Check size={16} className="shrink-0 text-chart-2" />}</div>
}

function PreferenceRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>
}

function EmptyLine({ text }: { text: string }) { return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</p> }

function EmptyState({ icon: Icon, title, text }: { icon: typeof CalendarDays; title: string; text: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center"><Icon size={26} className="text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>
}

function MiniAppLoading() {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Загружаем кабинет…</p></div></main>
}

function MiniAppError({ message }: { message: string }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground"><div className="max-w-sm text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted"><Dumbbell size={22} /></div><h1 className="mt-4 text-xl font-semibold">Кабинет недоступен</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} />Вернитесь в бот и откройте кабинет снова</div></div></main>
}
