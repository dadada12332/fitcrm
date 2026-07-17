"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Bell,
  X, AlertTriangle, Clock, CreditCard as CardIcon,
  PanelLeft, Sun, Moon, Inbox, CheckCircle2, Loader2, ChevronRight,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { globalSearchAction, getNotificationsAction, getRequestsAction, type GlobalSearchResult, type AppNotification, type AppRequest } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Breadcrumbs } from "./Breadcrumbs"

type Props = { clubName: string; email: string; onToggleSidebar?: () => void }

// ── Global Search ────────────────────────────────────────────────
function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router   = useRouter()
  const debRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    if (query.trim().length < 1) { setResults([]); return }
    setLoading(true)
    debRef.current = setTimeout(async () => {
      const res = await globalSearchAction(query)
      setResults(res)
      setLoading(false)
    }, 200)
  }, [query])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  const statusColor = (s: string | null) =>
    s === "active" ? "#16a34a" : s === "expired" ? "#dc2626" : "var(--gray-muted)"
  const statusLabel = (s: string | null) =>
    s === "active" ? "Активен" : s === "expired" ? "Истёк" : s === "frozen" ? "Заморожен" : "—"

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center pt-[12vh] px-4"
      style={{ background: "rgba(2,6,23,0.4)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <Search className="w-5 h-5 flex-shrink-0 text-zinc-400 dark:text-zinc-500" style={{ color: loading ? "#3b82f6" : undefined }} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск клиентов по имени или телефону..."
            className="flex-1 text-base outline-none bg-transparent text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600" />
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          </button>
        </div>
        {results.length > 0 ? (
          <div className="py-2 max-h-96 overflow-y-auto">
            {results.map((r) => (
              <button key={r.id} onClick={() => { router.push(`/clients/${r.id}`); onClose() }}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: "#3b82f6" }}>
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{r.name}</p>
                  {r.phone && <p className="text-xs mt-0.5 text-zinc-400 dark:text-zinc-500">{r.phone}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {r.membershipName && <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.membershipName}</p>}
                  <p className="text-xs font-medium mt-0.5" style={{ color: statusColor(r.status) }}>{statusLabel(r.status)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 && !loading ? (
          <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Клиент не найден</div>
        ) : (
          <div className="py-6 text-center text-xs text-zinc-300 dark:text-zinc-600">Введите имя или телефон</div>
        )}
      </div>
      <p className="mt-3 text-xs text-white/40">Esc — закрыть</p>
    </div>
  )
}

// ── Notifications Drawer (2 таба: Уведомления / Заявки) ───────────
function fmtReqDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function fmtNotificationDate(iso: string | null, type: AppNotification["type"]) {
  if (!iso) return null
  const options: Intl.DateTimeFormatOptions = type === "pending"
    ? { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "long", year: "numeric" }
  return new Date(iso).toLocaleDateString("ru-RU", options)
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"notifs" | "requests">("notifs")
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null)
  const [requests, setRequests] = useState<AppRequest[] | null>(null)
  const [, start] = useTransition()

  useEffect(() => {
    start(async () => {
      const [n, r] = await Promise.all([getNotificationsAction(), getRequestsAction()])
      setNotifs(n)
      setRequests(r)
    })
  }, [])

  const counts = {
    expired: notifs?.filter((n) => n.type === "expired").length ?? 0,
    expiring: notifs?.filter((n) => n.type === "expiring").length ?? 0,
    pending: notifs?.filter((n) => n.type === "pending").length ?? 0,
  }

  const notificationMeta = (type: AppNotification["type"]) => {
    if (type === "expired") return {
      icon: <AlertTriangle className="size-4" />,
      iconClass: "bg-destructive/10 text-destructive",
      badgeClass: "bg-destructive/10 text-destructive",
    }
    if (type === "expiring") return {
      icon: <Clock className="size-4" />,
      iconClass: "bg-brand/10 text-brand",
      badgeClass: "bg-brand/10 text-brand",
    }
    return {
      icon: <CardIcon className="size-4" />,
      iconClass: "bg-secondary text-foreground",
      badgeClass: "bg-secondary text-foreground",
    }
  }

  const TabBtn = ({ id, label, count }: { id: "notifs" | "requests"; label: string; count: number | null }) => {
    const active = tab === id
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        {label}
        {count !== null && count > 0 && (
          <span className={`rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
        )}
      </button>
    )
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="max-w-[500px]">
        <SheetHeader className="h-auto min-h-20 gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <SheetTitle>Центр уведомлений</SheetTitle>
            <p className="mt-1 text-sm text-muted-foreground">События, которые требуют вашего внимания</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть уведомления" className="shrink-0">
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="border-b border-border px-5 py-3 sm:px-6">
          <div className="flex rounded-lg bg-muted p-1">
            <TabBtn id="notifs" label="Уведомления" count={notifs?.length ?? null} />
            <TabBtn id="requests" label="Заявки" count={requests?.length ?? null} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background/50">
          {tab === "notifs" && (
            notifs === null ? (
              <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : notifs.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg bg-secondary">
                  <CheckCircle2 className="size-5 text-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Всё под контролем</p>
                <p className="mt-1 text-sm text-muted-foreground">Новых уведомлений пока нет</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 border-b border-border bg-card px-5 py-4 sm:px-6">
                  {[
                    { label: "Истекли", value: counts.expired, className: "text-destructive" },
                    { label: "Истекают", value: counts.expiring, className: "text-brand" },
                    { label: "Платежи", value: counts.pending, className: "text-foreground" },
                  ].map((item, index) => (
                    <div key={item.label} className={`min-w-0 ${index > 0 ? "border-l border-border pl-4" : ""}`}>
                      <p className={`text-xl font-semibold ${item.className}`}>{item.value}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="px-5 pb-5 pt-4 sm:px-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Требуют внимания</p>
                    <span className="text-xs text-muted-foreground">{notifs.length} событий</span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {notifs.map((n) => {
                      const meta = notificationMeta(n.type)
                      const eventDate = fmtNotificationDate(n.eventDate, n.type)
                      return (
                        <Link
                          key={n.id}
                          href={`/clients/${n.clientId}`}
                          onClick={onClose}
                          prefetch={false}
                          className="group flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/60"
                        >
                          <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="truncate text-sm font-semibold text-foreground">{n.clientName}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}>{n.detail}</span>
                            </div>
                            <p className="mt-1 text-sm text-foreground">{n.title}</p>
                            {(n.membershipName || eventDate) && (
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {[n.membershipName, eventDate].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          )}

          {tab === "requests" && (
            requests === null ? (
              <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : requests.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg bg-secondary">
                  <Inbox className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Заявок пока нет</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Здесь появятся заявки на подключение платёжных систем и смену тарифа.</p>
              </div>
            ) : (
              <div className="px-5 py-4 sm:px-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">История заявок</p>
                  <span className="text-xs text-muted-foreground">{requests.length} всего</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                        {r.kind === "payment" ? <CardIcon className="size-4" /> : <Inbox className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{r.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>{fmtReqDate(r.createdAt)}</p>
                      </div>
                      <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">{r.statusLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── TopBar ───────────────────────────────────────────────────────
export function TopBar({ clubName, email, onToggleSidebar }: Props) {
  const [searchOpen, setSearchOpen]   = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [notifCount, setNotifCount]   = useState<number | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  useEffect(() => {
    getNotificationsAction().then((n) => setNotifCount(n.length)).catch(() => {})
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [])

  return (
    <>
      <header className="flex items-center flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800"
        style={{ height: 64, paddingLeft: 16, paddingRight: 16, gap: 12 }}>

        {/* Sidebar toggle + divider */}
        <div className="flex items-center flex-shrink-0" style={{ gap: 12 }}>
          <button
            onClick={onToggleSidebar}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            style={{ width: 28, height: 28 }}
            aria-label="Переключить боковое меню"
            title="Переключить боковое меню"
          >
            <PanelLeft style={{ width: 16, height: 16 }} />
          </button>
          <div className="flex-shrink-0 bg-zinc-200 dark:bg-zinc-700" style={{ width: 1, height: 16 }} />
        </div>

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0">
          <Breadcrumbs />
        </div>

        {/* Right actions */}
        <div className="flex items-center flex-shrink-0" style={{ gap: 4 }}>

          {/* Search */}
          <button onClick={() => { setSearchOpen(true); setNotifOpen(false) }}
            className="flex items-center gap-2.5 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
            style={{ height: 36, width: 260, paddingLeft: 12, paddingRight: 10, fontSize: 13 }}>
            <Search style={{ width: 15, height: 15, flexShrink: 0 }} />
            <span className="flex-1 text-left">Поиск</span>
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 font-mono" style={{ fontSize: 11 }}>⌘K</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            style={{ width: 32, height: 32 }}
            title={isDark ? "Светлая тема" : "Тёмная тема"}
          >
            {isDark
              ? <Sun style={{ width: 20, height: 20 }} />
              : <Moon style={{ width: 20, height: 20 }} />
            }
          </button>

          {/* Bell */}
          <div ref={notifRef} className="relative">
            <button onClick={() => { setNotifOpen((v) => !v) }}
              aria-label="Открыть уведомления"
              className="flex items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 relative"
              style={{ width: 32, height: 32 }}>
              <Bell style={{ width: 20, height: 20 }} />
              {notifCount !== null && notifCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: "#dc2626", fontSize: 8 }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
            {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
          </div>

        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={closeSearch} />}
    </>
  )
}
