"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Bell,
  X, AlertTriangle, Clock, CreditCard as CardIcon,
  PanelLeft, Sun, Moon, Inbox, CheckCircle2, Loader2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { globalSearchAction, getNotificationsAction, getRequestsAction, type GlobalSearchResult, type AppNotification, type AppRequest } from "@/app/(app)/actions"
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

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"notifs" | "requests">("notifs")
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null)
  const [requests, setRequests] = useState<AppRequest[] | null>(null)
  const [, start] = useTransition()

  useEffect(() => {
    start(async () => {
      const [n, r] = await Promise.all([getNotificationsAction(), getRequestsAction()])
      setNotifs(n); setRequests(r)
    })
  }, [])

  const iconFor = (type: AppNotification["type"]) => {
    if (type === "expiring") return <Clock className="w-4 h-4" style={{ color: "#d97706" }} />
    if (type === "expired")  return <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
    return <CardIcon className="w-4 h-4" style={{ color: "#2563eb" }} />
  }
  const bgFor = (type: AppNotification["type"]) =>
    type === "expiring" ? "rgba(217,119,6,0.14)" : type === "expired" ? "rgba(220,38,38,0.14)" : "rgba(37,99,235,0.14)"

  const TabBtn = ({ id, label, count }: { id: "notifs" | "requests"; label: string; count: number | null }) => {
    const active = tab === id
    return (
      <button onClick={() => setTab(id)}
        className="flex-1 flex items-center justify-center gap-1.5 h-10 text-sm font-medium transition-colors relative"
        style={{ color: active ? "var(--on-dark)" : "var(--on-dark-soft)" }}>
        {label}
        {count !== null && count > 0 && (
          <span className="text-[11px] px-1.5 rounded-full font-semibold"
            style={{ background: active ? "#2563eb" : "var(--card-2)", color: active ? "white" : "var(--on-dark-soft)" }}>{count}</span>
        )}
        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#2563eb" }} />}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose} style={{ background: "rgba(2,6,23,0.4)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm h-full flex flex-col" style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>Уведомления</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <TabBtn id="notifs" label="Уведомления" count={notifs?.length ?? null} />
          <TabBtn id="requests" label="Заявки" count={requests?.length ?? null} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "notifs" && (
            notifs === null ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--gray-muted)" }} /></div>
            ) : notifs.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#16a34a" }} />
                <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Нет уведомлений</p>
              </div>
            ) : notifs.map((n) => (
              <Link key={n.id} href={`/clients/${n.clientId}`} onClick={onClose}
                className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bgFor(n.type) }}>
                  {iconFor(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{n.clientName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{n.detail}</p>
                </div>
              </Link>
            ))
          )}

          {tab === "requests" && (
            requests === null ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--gray-muted)" }} /></div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center">
                <Inbox className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--gray-muted)" }} />
                <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Заявок пока нет</p>
                <p className="text-xs mt-1 px-8" style={{ color: "var(--gray-muted)" }}>Здесь появятся заявки на подключение платёжек и смену тарифа с их статусом.</p>
              </div>
            ) : requests.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--card-2)" }}>
                  {r.kind === "payment" ? <CardIcon className="w-4 h-4" style={{ color: "#2563eb" }} /> : <Inbox className="w-4 h-4" style={{ color: "#7c3aed" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{r.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }} suppressHydrationWarning>{fmtReqDate(r.createdAt)}</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5"
                  style={{ background: `color-mix(in srgb, ${r.statusColor} 14%, transparent)`, color: r.statusColor }}>
                  {r.statusLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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
