"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Bell, LogOut,
  X, AlertTriangle, Clock, CreditCard as CardIcon,
  Settings, UserCog, HelpCircle, PanelLeft, Sun, Moon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { signOut } from "@/app/(auth)/actions"
import { globalSearchAction, getNotificationsAction, type GlobalSearchResult, type AppNotification } from "@/app/(app)/actions"
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
    if (query.trim().length < 2) { setResults([]); return }
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
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
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

// ── Notifications Panel ──────────────────────────────────────────
function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null)
  const [, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    start(async () => { setNotifs(await getNotificationsAction()) })
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [onClose])

  const iconFor = (type: AppNotification["type"]) => {
    if (type === "expiring") return <Clock className="w-4 h-4" style={{ color: "#d97706" }} />
    if (type === "expired")  return <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
    return <CardIcon className="w-4 h-4" style={{ color: "#2563eb" }} />
  }
  const bgFor = (type: AppNotification["type"]) =>
    type === "expiring" ? "#fef3c7" : type === "expired" ? "#fee2e2" : "#dbeafe"

  return (
    <div ref={ref} className="absolute right-0 top-11 z-20 w-80 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
      style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Уведомления</p>
        {notifs && notifs.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fee2e2", color: "#dc2626" }}>
            {notifs.length}
          </span>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {notifs === null ? (
          <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">Загрузка...</div>
        ) : notifs.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Нет уведомлений</div>
        ) : notifs.map((n) => (
          <Link key={n.id} href={`/clients/${n.clientId}`} onClick={onClose}
            className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-50 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: bgFor(n.type) }}>
              {iconFor(n.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-zinc-950 dark:text-zinc-50">{n.clientName}</p>
              <p className="text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">{n.detail}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── TopBar ───────────────────────────────────────────────────────
export function TopBar({ clubName, email, onToggleSidebar }: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
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

  const initials = email.charAt(0).toUpperCase()

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
          <button onClick={() => { setSearchOpen(true); setNotifOpen(false); setProfileOpen(false) }}
            className="flex items-center gap-2 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
            style={{ height: 28, paddingLeft: 12, paddingRight: 12, fontSize: 13 }}>
            <Search style={{ width: 14, height: 14 }} />
            <span className="hidden sm:block">Поиск</span>
            <span className="hidden sm:block px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500" style={{ fontSize: 10 }}>⌘K</span>
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
            <button onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false) }}
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

          {/* Avatar */}
          <div className="relative">
            <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
              className="flex items-center justify-center rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ width: 28, height: 28, background: "var(--on-dark)" }}>
              {initials}
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-9 z-20 w-52 rounded-xl py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                  <div className="px-3 py-2.5 mb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="font-medium truncate text-sm text-zinc-900 dark:text-zinc-50">{clubName}</p>
                    <p className="text-xs truncate text-zinc-400 dark:text-zinc-500">{email}</p>
                  </div>

                  {([
                    { href: "/settings/club", icon: Settings, label: "Настройки клуба" },
                    { href: "/staff",         icon: UserCog,  label: "Сотрудники" },
                    { href: "/support",       icon: HelpCircle, label: "Поддержка" },
                  ] as const).map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <Icon className="w-4 h-4 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
                      {label}
                    </Link>
                  ))}

                  <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                  <form action={signOut}>
                    <button type="submit" className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 dark:text-red-400">
                      <LogOut className="w-4 h-4" />Выйти
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={closeSearch} />}
    </>
  )
}
