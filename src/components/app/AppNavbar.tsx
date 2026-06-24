"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, CreditCard, Calendar, Wallet, CheckSquare,
  Search, Bell, Zap, LogOut, ChevronDown, Check, Plus, Building2,
  X, AlertTriangle, Clock, CreditCard as CardIcon,
  Settings, UserCog, HelpCircle, SlidersHorizontal,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { signOut } from "@/app/(auth)/actions"
import { globalSearchAction, getNotificationsAction, type GlobalSearchResult, type AppNotification } from "@/app/(app)/actions"

const nav = [
  { href: "/dashboard",   label: "Дашборд",    icon: LayoutDashboard },
  { href: "/clients",     label: "Клиенты",    icon: Users },
  { href: "/memberships", label: "Абонементы", icon: CreditCard },
  { href: "/schedule",    label: "Расписание", icon: Calendar },
  { href: "/visits",      label: "Посещения",  icon: CheckSquare },
  { href: "/payments",    label: "Оплата",     icon: Wallet },
]

type Props = { clubName: string; email: string }

// ── Global Search Overlay ──────────────────────────────────────────
function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery]   = useState("")
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function go(id: string) { router.push(`/clients/${id}`); onClose() }

  const statusColor = (s: string | null) =>
    s === "active" ? "#16a34a" : s === "expired" ? "#dc2626" : "#94a3b8"
  const statusLabel = (s: string | null) =>
    s === "active" ? "Активен" : s === "expired" ? "Истёк" : s === "frozen" ? "Заморожен" : "—"

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center pt-[12vh] px-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: "white", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: loading ? "#3b82f6" : "#94a3b8" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск клиентов по имени или телефону..."
            className="flex-1 text-base outline-none"
            style={{ color: "#020617" }}
          />
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="py-2 max-h-96 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => go(r.id)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: "#3b82f6" }}>
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#020617" }}>{r.name}</p>
                  {r.phone && <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{r.phone}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {r.membershipName && <p className="text-xs" style={{ color: "#64748b" }}>{r.membershipName}</p>}
                  <p className="text-xs font-medium mt-0.5" style={{ color: statusColor(r.status) }}>{statusLabel(r.status)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 && !loading ? (
          <div className="py-8 text-center text-sm" style={{ color: "#94a3b8" }}>Клиент не найден</div>
        ) : query.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: "#cbd5e1" }}>Введите имя или телефон</div>
        ) : null}
      </div>
      <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Esc — закрыть</p>
    </div>
  )
}

// ── Notifications Panel ────────────────────────────────────────────
function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null)
  const [, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    start(async () => {
      const res = await getNotificationsAction()
      setNotifs(res)
    })
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  const iconFor = (type: AppNotification["type"]) => {
    if (type === "expiring") return <Clock className="w-4 h-4" style={{ color: "#d97706" }} />
    if (type === "expired")  return <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
    return <CardIcon className="w-4 h-4" style={{ color: "#2563eb" }} />
  }
  const bgFor = (type: AppNotification["type"]) =>
    type === "expiring" ? "#fef3c7" : type === "expired" ? "#fee2e2" : "#dbeafe"

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-20 w-80 rounded-xl overflow-hidden"
      style={{ background: "white", border: "1px solid #e2e8f0", boxShadow: "0 12px 40px rgba(0,0,0,0.14)" }}
    >
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <p className="text-sm font-semibold" style={{ color: "#020617" }}>Уведомления</p>
        {notifs && notifs.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fee2e2", color: "#dc2626" }}>
            {notifs.length}
          </span>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {notifs === null ? (
          <div className="py-8 text-center text-xs" style={{ color: "#94a3b8" }}>Загрузка...</div>
        ) : notifs.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: "#94a3b8" }}>Нет уведомлений</div>
        ) : (
          notifs.map((n) => (
            <Link
              key={n.id}
              href={`/clients/${n.clientId}`}
              onClick={onClose}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              style={{ borderBottom: "1px solid #f8fafc" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: bgFor(n.type) }}>
                {iconFor(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#020617" }}>{n.clientName}</p>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{n.detail}</p>
              </div>
            </Link>
          ))
        )}
      </div>

      {notifs && notifs.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
          <button onClick={onClose} className="text-xs" style={{ color: "#94a3b8" }}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Navbar ────────────────────────────────────────────────────
export function AppNavbar({ clubName, email }: Props) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen]   = useState(false)
  const [branchOpen, setBranchOpen]     = useState(false)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [notifOpen, setNotifOpen]       = useState(false)
  const [notifCount, setNotifCount]     = useState<number | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const initials = email.charAt(0).toUpperCase()
  const branches = [clubName]

  // Load notification count once on mount
  useEffect(() => {
    getNotificationsAction().then((n) => setNotifCount(n.length)).catch(() => {})
  }, [])

  // Cmd/Ctrl+K shortcut for search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-50 h-[60px] flex items-center px-4"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="relative flex items-center w-full">

          {/* ── Left: logo + branch ── */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--orange)" }}>
                  <Zap className="w-4 h-4 text-white" fill="white" />
                </span>
                <span className="text-sm hidden sm:block" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--on-dark)" }}>
                  FitCRM
                </span>
              </Link>

              <div className="relative hidden sm:block">
                <button
                  onClick={() => { setBranchOpen((v) => !v); setProfileOpen(false); setNotifOpen(false) }}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium transition-colors hover:bg-secondary"
                  style={{ color: "#64748b", border: "1px solid var(--border)" }}
                >
                  <Building2 className="w-3 h-3" />
                  <span className="max-w-[100px] truncate">{clubName}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>

                {branchOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setBranchOpen(false)} />
                    <div className="absolute left-0 top-8 z-20 w-52 rounded-xl py-1.5 text-sm"
                      style={{ background: "white", border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                      <div className="px-2.5 py-1.5 mb-1">
                        <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>Филиалы</p>
                      </div>
                      {branches.map((b) => (
                        <button key={b} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg mx-1 transition-colors hover:bg-slate-50"
                          style={{ width: "calc(100% - 8px)", color: "#020617" }}>
                          <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--orange)" }} />
                          <span className="truncate">{b}</span>
                        </button>
                      ))}
                      <div className="h-px mx-3 my-1.5" style={{ background: "#e5e7eb" }} />
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                        style={{ color: "#64748b" }} onClick={() => setBranchOpen(false)}>
                        <Plus className="w-3.5 h-3.5" />Добавить филиал
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Center: tabs ── */}
          <nav className="hidden md:flex items-center gap-0.5 p-1 rounded-md absolute left-1/2 -translate-x-1/2" style={{ background: "#f1f5f9" }}>
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
                  style={{
                    background: active ? "white" : "transparent",
                    color: active ? "var(--on-dark)" : "#64748b",
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    fontFamily: "Inter, sans-serif", letterSpacing: "-0.004em",
                  }}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
                </Link>
              )
            })}
          </nav>

          {/* ── Right: search, bell, avatar ── */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">

            {/* Search button */}
            <button
              onClick={() => { setSearchOpen(true); setNotifOpen(false); setProfileOpen(false) }}
              className="h-9 px-4 flex items-center gap-2 rounded-md text-xs transition-colors hover:bg-secondary"
              style={{ color: "#64748b", border: "1px solid var(--border)" }}
              title="Поиск (⌘K)"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:block">Поиск</span>
              <span className="hidden sm:block text-xs px-1.5 py-0.5 rounded" style={{ background: "#f1f5f9", color: "#94a3b8", fontSize: 10 }}>⌘K</span>
            </button>

            {/* Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false) }}
                className="w-10 h-9 flex items-center justify-center rounded-md transition-colors hover:bg-secondary relative"
                style={{ color: "#64748b" }}
                aria-label="Уведомления"
              >
                <Bell className="w-4 h-4" />
                {notifCount !== null && notifCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: "#dc2626", fontSize: 9, lineHeight: 1 }}
                  >
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Avatar */}
            <div className="relative ml-1">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-80"
                style={{ background: "var(--orange)" }}
                title={email}
              >
                {initials}
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-11 z-20 w-52 rounded-xl py-2 text-sm"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                    <div className="px-3 py-2.5 border-b border-border mb-1">
                      <p className="font-medium text-foreground truncate">{clubName}</p>
                      <p className="text-xs text-muted-foreground truncate">{email}</p>
                    </div>

                    {[
                      { href: "/settings/club",  icon: Settings,          label: "Настройки клуба" },
                      { href: "/staff",          icon: UserCog,           label: "Сотрудники" },
                      { href: "/settings",       icon: SlidersHorizontal, label: "Настройки CRM" },
                      { href: "/support",        icon: HelpCircle,        label: "Поддержка" },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setProfileOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                        style={{ color: "#334155" }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#64748b" }} />
                        {label}
                      </Link>
                    ))}

                    <div className="my-1" style={{ borderTop: "1px solid #f1f5f9" }} />

                    <form action={signOut}>
                      <button type="submit" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" />Выйти
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={closeSearch} />}
    </>
  )
}
