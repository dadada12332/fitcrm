"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import {
  LayoutDashboard, Users, CreditCard, Activity,
  Calendar, Wallet, Package, UserCog, BarChart2,
  Settings, HelpCircle, BookOpen,
  ChevronDown, Check, Plus, LogOut,
  GitFork, User, ShieldCheck,
} from "lucide-react"
import { getBranchesAction, switchBranchAction } from "@/app/(app)/actions"
import { signOut } from "@/app/(auth)/actions"
import type { SidebarStats } from "@/lib/sidebar"

const PLAN_LABELS: Record<string, string> = {
  trial: "Пробный",
  starter: "Стартер",
  standard: "Стандарт",
  business: "Бизнес",
}

// ── Badge ────────────────────────────────────────────────────────
function Badge({ value, type = "count" }: { value: string | number; type?: "count" | "live" | "warn" | "new" }) {
  if (type === "count") {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums flex-shrink-0">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </span>
    )
  }
  if (type === "live") {
    return (
      <span className="flex items-center gap-1 flex-shrink-0">
        <style>{`
          @keyframes live-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
          }
        `}</style>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "live-pulse 1.5s ease-in-out infinite" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", letterSpacing: "0.06em" }}>LIVE</span>
      </span>
    )
  }
  if (type === "warn") {
    return (
      <span className="text-xs font-medium flex-shrink-0" style={{ color: "#d97706" }}>
        {value} ⚠
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#ede9fe", color: "#7c3aed", letterSpacing: "0.04em" }}>
      {value}
    </span>
  )
}

// ── NavItem ──────────────────────────────────────────────────────
function NavItem({
  href, icon: Icon, label, badge, badgeType, collapsed,
}: {
  href: string
  icon: React.ElementType
  label: string
  badge?: string | number
  badgeType?: "count" | "live" | "warn" | "new"
  collapsed?: boolean
}) {
  const pathname = usePathname()
  const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center rounded-md transition-colors ${
        active
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
      }`}
      style={{
        height: 32,
        paddingLeft: collapsed ? 0 : 8,
        paddingRight: collapsed ? 0 : 8,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 8,
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      <Icon style={{ width: 16, height: 16, flexShrink: 0 }} className={active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"} />
      {!collapsed && (
        <>
          <span className={`flex-1 text-sm whitespace-nowrap ${active ? "font-medium text-zinc-900 dark:text-zinc-100" : "font-normal text-zinc-600 dark:text-zinc-400"}`}>
            {label}
          </span>
          {badge !== undefined && badge !== "" && (
            <Badge value={badge} type={badgeType ?? "count"} />
          )}
        </>
      )}
    </Link>
  )
}

// ── AI NavItem (gradient shimmer) ────────────────────────────────
function AINavItem({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const active = pathname === "/ai" || pathname.startsWith("/ai/")

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="ai-stroke-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="50%"  stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <style>{`
        @keyframes ai-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ai-gradient-text {
          background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899, #6366f1);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ai-shimmer 4s ease infinite;
        }
      `}</style>

      <Link
        href="/ai"
        title={collapsed ? "AI Аналитика" : undefined}
        className={`flex items-center rounded-md transition-colors ${
          active ? "bg-violet-50 dark:bg-violet-950/30" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
        }`}
        style={{
          height: 32,
          paddingLeft: collapsed ? 0 : 8,
          paddingRight: collapsed ? 0 : 8,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 8,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          overflow="visible"
          stroke="url(#ai-stroke-gradient)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 1-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" /><path d="M22 5h-4" />
          <path d="M4 17v2" /><path d="M5 18H3" />
        </svg>

        {!collapsed && (
          <>
            <span className="ai-gradient-text flex-1 text-sm font-normal" style={{ fontWeight: active ? 500 : 400 }}>
              AI Аналитика
            </span>
            <Badge value="NEW" type="new" />
          </>
        )}
      </Link>
    </>
  )
}

// ── SectionLabel ─────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600" style={{ padding: "8px 8px 4px" }}>
      {label}
    </p>
  )
}

// ── Divider ──────────────────────────────────────────────────────
function Divider() {
  return <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1.5" />
}

// ── QuickAction ──────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { href: "/clients",     icon: Users,    label: "Новый клиент" },
  { href: "/payments",    icon: Wallet,   label: "Новая оплата" },
  { href: "/memberships", icon: CreditCard, label: "Новый абонемент" },
  { href: "/visits",      icon: Activity, label: "Отметить посещение" },
  { href: "/staff",       icon: UserCog,  label: "Добавить сотрудника" },
]

function QuickAction({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [open])

  return (
    <div ref={ref} className="relative px-2 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 rounded-md transition-colors bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
        style={{ height: 32, fontSize: 13, fontWeight: 500 }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        {!collapsed && "Быстрое действие"}
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 rounded-lg overflow-hidden z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {QUICK_ACTIONS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200"
            >
              <Icon className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" style={{ width: 15, height: 15 }} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────────
type Props = {
  clubId: string
  clubName: string
  plan: string
  stats: SidebarStats
  collapsed?: boolean
}

export function Sidebar({ clubId, clubName, plan, stats, collapsed = false }: Props) {
  const router = useRouter()
  const [clubOpen, setClubOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [branches, setBranches] = useState<any[]>([])
  const [branchesLoaded, setBranchesLoaded] = useState(false)
  const [, startTransition] = useTransition()
  const clubRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (clubRef.current && !clubRef.current.contains(e.target as Node)) setClubOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  const openClub = async () => {
    setClubOpen((v) => !v)
    if (!branchesLoaded) {
      const data = await getBranchesAction()
      setBranches(data)
      setBranchesLoaded(true)
    }
  }

  const switchBranch = (branchId: string) => {
    setClubOpen(false)
    startTransition(async () => {
      await switchBranchAction(branchId)
      router.refresh()
    })
  }

  const isTrial = plan === "trial"
  const planLabel = PLAN_LABELS[plan] ?? plan
  const clubSubtitle = isTrial && stats.trialDaysLeft !== null
    ? `Trial · осталось ${stats.trialDaysLeft} дн.`
    : planLabel
  const statusColor = isTrial ? "#f59e0b" : "#22c55e"

  return (
    <aside className="hidden md:flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
      style={{ boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }}>

      {/* ── Club card ── */}
      <div ref={clubRef} className="relative px-2 pt-2 flex-shrink-0">
        <button
          onClick={openClub}
          className="w-full flex items-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          style={{ padding: "8px 10px", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <div className="flex-shrink-0 flex items-center justify-center font-semibold text-white"
            style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, fontSize: 14 }}>
            {clubName.charAt(0).toUpperCase()}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                  {clubName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{clubSubtitle}</p>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            </>
          )}
        </button>

        {/* Club dropdown */}
        {clubOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 rounded-lg overflow-hidden z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
            {branches.length > 0 && (
              <div className="py-1 border-b border-zinc-100 dark:border-zinc-800">
                {branches.map((b: any) => (
                  <button
                    key={b.clubId}
                    onClick={() => switchBranch(b.clubId)}
                    className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex-shrink-0 flex items-center justify-center font-semibold text-xs rounded-md"
                      style={{ width: 24, height: 24, background: b.clubId === clubId ? "#2563eb" : undefined, color: b.clubId === clubId ? "white" : undefined }}
                    >
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm text-left text-zinc-800 dark:text-zinc-200">{b.name}</span>
                    {b.clubId === clubId && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
            <div className="py-1">
              <Link href="/onboarding" onClick={() => setClubOpen(false)} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <GitFork className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Создать филиал
              </Link>
              <Link href="/settings/club" onClick={() => setClubOpen(false)} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <Settings className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Настройки клуба
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick action ── */}
      <div className="pt-2 flex-shrink-0">
        <QuickAction collapsed={collapsed} />
      </div>

      <Divider />

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/dashboard"   icon={LayoutDashboard} label="Дашборд"    collapsed={collapsed} />
          <NavItem href="/clients"     icon={Users}      label="Клиенты"    collapsed={collapsed} badge={stats.clientCount > 0 ? stats.clientCount : undefined}            badgeType="count" />
          <NavItem href="/memberships" icon={CreditCard} label="Абонементы" collapsed={collapsed} badge={stats.activeMembershipCount > 0 ? stats.activeMembershipCount : undefined}  badgeType="count" />
        </div>

        <Divider />

        {!collapsed && <SectionLabel label="Операции" />}
        <div className="flex flex-col gap-0.5">
          <NavItem href="/visits"    icon={Activity} label="Посещения"  collapsed={collapsed} badge={stats.todayVisits > 0 ? "LIVE" : undefined}                    badgeType="live" />
          <NavItem href="/schedule"  icon={Calendar} label="Расписание" collapsed={collapsed} />
          <NavItem href="/payments"  icon={Wallet}   label="Оплаты"     collapsed={collapsed} />
          <NavItem href="/warehouse" icon={Package}  label="Склад"      collapsed={collapsed} badge={stats.lowStockCount > 0 ? stats.lowStockCount : undefined} badgeType="warn" />
        </div>

        <Divider />

        {!collapsed && <SectionLabel label="Управление" />}
        <div className="flex flex-col gap-0.5">
          <NavItem href="/staff"   icon={UserCog}   label="Сотрудники"    collapsed={collapsed} />
          <NavItem href="/reports" icon={BarChart2}  label="Отчёты"        collapsed={collapsed} />
          <AINavItem collapsed={collapsed} />
        </div>

        <Divider />

        <div className="flex flex-col gap-0.5">
          <NavItem href="/settings/club" icon={Settings} label="Настройки клуба" collapsed={collapsed} />
        </div>
      </nav>

      <Divider />

      <div className="flex-shrink-0 px-2 pb-1">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/support" icon={HelpCircle} label="Поддержка"   collapsed={collapsed} />
          <NavItem href="/knowledge" icon={BookOpen}   label="База знаний" collapsed={collapsed} />
        </div>
      </div>

      <Divider />

      {/* ── User profile ── */}
      <div ref={userRef} className="relative px-2 pb-2 flex-shrink-0">
        <button
          onClick={() => setUserOpen((v) => !v)}
          className="w-full flex items-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          style={{ padding: "8px 10px", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <div className="flex-shrink-0 flex items-center justify-center font-semibold text-white"
            style={{ width: 32, height: 32, background: "#6366f1", borderRadius: "50%", fontSize: 13 }}>
            {stats.userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{stats.userName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{stats.userRole}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            </>
          )}
        </button>

        {userOpen && (
          <div className="absolute left-2 right-2 bottom-full mb-1 rounded-lg overflow-hidden z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
            style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.15)" }}>
            <div className="py-1">
              <Link href="/profile" onClick={() => setUserOpen(false)}
                className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <User className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Профиль
              </Link>
              <Link href="/settings/security" onClick={() => setUserOpen(false)}
                className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Настройки аккаунта
              </Link>
            </div>
            <div className="py-1 border-t border-zinc-100 dark:border-zinc-800">
              <form action={signOut}>
                <button type="submit" className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 text-sm text-red-500 dark:text-red-400">
                  <LogOut className="w-3.5 h-3.5" />
                  Выйти
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
