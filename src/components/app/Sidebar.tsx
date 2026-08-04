"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  LayoutDashboard, Users, CreditCard, Activity,
  Calendar, Wallet, Package, UserCog, BarChart2,
  Settings, HelpCircle, BookOpen, Plug,
  ChevronDown, Check,
  GitFork,
  HeartHandshake, Rocket,
  MessagesSquare,
  Crown,
} from "lucide-react"
import { getBranchesAction, switchBranchAction, type Branch } from "@/app/(app)/actions"
import { QuickActionsMenu } from "@/components/app/QuickActionsMenu"
import { ConfirmSignOut } from "@/components/app/ConfirmSignOut"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resolveAvatarBackground, type AvatarMeta } from "@/lib/avatar"
import type { SidebarStats } from "@/lib/sidebar"
import type { RolePermissions } from "@/lib/permissions"
import { planFeatureEnabled, planSectionEnabled, type PlanAccess } from "@/lib/plan-access"
import { useAppLocale } from "./ClubContext"
import { BrandLogo } from "@/components/brand/BrandLogo"
import type { PlatformSubscriptionState } from "@/lib/platform-subscription"

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
  href, icon: Icon, label, badge, badgeType, collapsed, tour,
}: {
  href: string
  icon: React.ElementType
  label: string
  badge?: string | number
  badgeType?: "count" | "live" | "warn" | "new"
  collapsed?: boolean
  tour?: string
}) {
  const pathname = usePathname()
  const [prefetch, setPrefetch] = useState(false)
  const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      data-tour={tour}
      href={href}
      prefetch={prefetch ? null : false}
      onMouseEnter={() => setPrefetch(true)}
      onFocus={() => setPrefetch(true)}
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
      <Icon style={{ width: 18, height: 18, flexShrink: 0 }} className={active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"} />
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
  const { t } = useAppLocale()
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
        title={collapsed ? t("nav.ai") : undefined}
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
          width="18" height="18" viewBox="0 0 24 24" fill="none"
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
              {t("nav.ai")}
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

// ── QuickAction removed — replaced by QuickActionsDrawer ─────────

// ── Main Sidebar ─────────────────────────────────────────────────
type Props = {
  clubId: string
  clubName: string
  plan: string
  stats: SidebarStats
  permissions: RolePermissions
  planAccess: PlanAccess | null
  role: string
  subscriptionState: PlatformSubscriptionState
  bypassSubscriptionLock?: boolean
  collapsed?: boolean
  mobile?: boolean
}

export function Sidebar({ clubId, clubName, plan, stats, permissions, planAccess, role, subscriptionState, bypassSubscriptionLock = false, collapsed = false, mobile = false }: Props) {
  const { t } = useAppLocale()
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [, startTransition] = useTransition()

  const isOwner = role === "owner"
  const p = permissions
  const billingOnly = subscriptionState.isLocked && !bypassSubscriptionLock
  const canUseBranches = planFeatureEnabled(planAccess, "multi_branch")

  const loadBranches = async (open: boolean) => {
    if (!open || branches.length > 0 || branchesLoading) return
    setBranchesLoading(true)
    const data = await getBranchesAction()
    setBranches(data)
    setBranchesLoading(false)
  }

  const switchBranch = (branchId: string) => {
    if (branchId === clubId) return
    startTransition(async () => {
      await switchBranchAction(branchId)
      // A full navigation clears prefetched Router Cache from the previous tenant.
      window.location.assign("/dashboard")
    })
  }

  const isTrial = plan === "trial"
  const planLabel = plan === "trial" ? t("nav.trial") : PLAN_LABELS[plan] ?? plan
  const clubSubtitle = subscriptionState.kind === "suspended"
    ? "Доступ приостановлен"
    : subscriptionState.isExpired
      ? `${planLabel} · подписка истекла`
      : subscriptionState.isExpiring
        ? `${planLabel} · ${t("nav.daysLeft", { count: subscriptionState.daysLeft ?? 0 })}`
        : isTrial && stats.trialDaysLeft !== null
          ? `${t("nav.trial")} · ${t("nav.daysLeft", { count: stats.trialDaysLeft })}`
          : planLabel
  const statusColor = subscriptionState.kind === "suspended" || subscriptionState.isExpired
    ? "var(--destructive)"
    : subscriptionState.isExpiring || isTrial
      ? "var(--chart-4)"
      : "var(--chart-2)"

  return (
    <aside className={`${mobile ? "flex" : "hidden md:flex"} flex-col h-full w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg`}
      style={{ boxShadow: "0px 1px 2px rgba(0,0,0,0.05)" }}>

      <div className={`flex h-12 shrink-0 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-1" : "px-4"}`}>
        <BrandLogo href="/dashboard" compact={collapsed} quiet priority />
      </div>

      {/* ── Club card ── */}
      <div className="px-2 pt-2 flex-shrink-0">
        <DropdownMenu onOpenChange={loadBranches}>
          <DropdownMenuTrigger
            aria-label={t("nav.switchClub")}
            title={collapsed ? clubName : undefined}
            className="flex w-full items-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ padding: "8px 10px", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">
              {clubName.charAt(0).toUpperCase()}
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-foreground">{clubName}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                    <p className="truncate text-xs text-muted-foreground">{clubSubtitle}</p>
                  </div>
                </div>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-64"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("nav.switchClub")}</DropdownMenuLabel>
              {branchesLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Загрузка…</p>
              ) : branches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Других клубов нет</p>
              ) : branches.map((b) => (
                <DropdownMenuItem key={b.clubId} onClick={() => switchBranch(b.clubId)}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                    b.clubId === clubId ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {b.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.clubId === clubId && <Check className="size-4 text-brand" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {isOwner && canUseBranches && !billingOnly && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings/branches")}>
                  <GitFork />
                  {t("nav.addClub")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Quick action ── */}
      {!billingOnly && (
        <div className="pt-2 flex-shrink-0" data-tour="quick-actions">
          <QuickActionsMenu collapsed={collapsed} />
        </div>
      )}

      <Divider />

      {/* ── Nav ── */}
      {billingOnly ? (
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
          <div className="flex flex-col gap-0.5">
            {subscriptionState.kind !== "suspended" && p.settings.subscription && (
              <NavItem href="/settings/subscription" icon={Crown} label={t("settings.subscription")} collapsed={collapsed} />
            )}
            <NavItem href="/support" icon={HelpCircle} label={t("nav.support")} collapsed={collapsed} badge={stats.supportUnread > 0 ? stats.supportUnread : undefined} badgeType="warn" />
          </div>
        </nav>
      ) : (
        <>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/dashboard" icon={LayoutDashboard} label={t("nav.dashboard")} collapsed={collapsed} />
          {p.clients.view && (
            <NavItem href="/clients" icon={Users} label={t("nav.clients")} collapsed={collapsed} tour="nav-clients" badge={stats.clientCount > 0 ? stats.clientCount : undefined} badgeType="count" />
          )}
          {p.memberships.view && (
            <NavItem href="/memberships" icon={CreditCard} label={t("nav.memberships")} collapsed={collapsed} tour="nav-memberships" badge={stats.activeMembershipCount > 0 ? stats.activeMembershipCount : undefined} badgeType="count" />
          )}
        </div>

        {(p.visits.view || p.inbox.view || p.schedule.view || p.payments.view || p.warehouse.view) && (
          <>
            <Divider />
            {!collapsed && <SectionLabel label={t("nav.operations")} />}
            <div className="flex flex-col gap-0.5">
              {p.visits.view && (
                <NavItem href="/visits" icon={Activity} label={t("nav.visits")} collapsed={collapsed} badge={stats.todayVisits > 0 ? "LIVE" : undefined} badgeType="live" />
              )}
              {p.inbox.view && (
                <NavItem href="/inbox" icon={MessagesSquare} label={t("nav.inbox")} collapsed={collapsed} badge={stats.inboxUnread > 0 ? stats.inboxUnread : undefined} badgeType="count" />
              )}
              {p.schedule.view && (
                <NavItem href="/schedule" icon={Calendar} label={t("nav.schedule")} collapsed={collapsed} />
              )}
              {p.payments.view && (
                <NavItem href="/payments" icon={Wallet} label={t("nav.payments")} collapsed={collapsed} />
              )}
              {p.warehouse.view && (
                <NavItem href="/warehouse" icon={Package} label={t("nav.warehouse")} collapsed={collapsed} badge={stats.lowStockCount > 0 ? stats.lowStockCount : undefined} badgeType="warn" />
              )}
            </div>
          </>
        )}

        {(p.staff.view || p.reports.view || p.settings.integrations || p.ai.use) && (
          <>
            <Divider />
            {!collapsed && <SectionLabel label={t("nav.management")} />}
            <div className="flex flex-col gap-0.5">
              {p.staff.view && (
                <NavItem href="/staff" icon={UserCog} label={t("nav.staff")} collapsed={collapsed} />
              )}
              {p.reports.view && p.clients.view && planSectionEnabled(planAccess, "retention") && planFeatureEnabled(planAccess, "retention") && (
                <NavItem href="/retention" icon={HeartHandshake} label={t("nav.retention")} collapsed={collapsed} badge="BETA" badgeType="new" />
              )}
              {p.reports.view && p.clients.view && planSectionEnabled(planAccess, "growth") && planFeatureEnabled(planAccess, "growth") && (
                <NavItem href="/growth" icon={Rocket} label="Growth OS" collapsed={collapsed} badge="LAB" badgeType="new" />
              )}
              {p.reports.view && (
                <NavItem href="/reports" icon={BarChart2} label={t("nav.reports")} collapsed={collapsed} />
              )}
              {p.settings.integrations && (
                <NavItem href="/integrations" icon={Plug} label={t("nav.integrations")} collapsed={collapsed} tour="nav-integrations" />
              )}
              {p.ai.use && (
                <AINavItem collapsed={collapsed} />
              )}
            </div>
          </>
        )}
      </nav>

      <Divider />

      <div className="flex-shrink-0 px-2 pb-1">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/settings" icon={Settings} label={t("nav.settings")} collapsed={collapsed} />
          <NavItem href="/support" icon={HelpCircle} label={t("nav.support")} collapsed={collapsed} badge={stats.supportUnread > 0 ? stats.supportUnread : undefined} badgeType="warn" />
          {planSectionEnabled(planAccess, "knowledge") && planFeatureEnabled(planAccess, "knowledge") && (
            <NavItem href="/support?tab=kb" icon={BookOpen} label={t("nav.knowledge")} collapsed={collapsed} />
          )}
        </div>
      </div>
        </>
      )}

      <Divider />

      {/* ── User profile ── */}
      <div className="px-2 pb-2 flex-shrink-0 flex items-center gap-1">
        <Link
          href="/profile"
          className="flex-1 flex items-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-0"
          style={{ padding: "8px 10px", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          {(() => {
            const avatarMeta: AvatarMeta = { preset: stats.avatarPreset, url: stats.avatarUrl }
            const initials = stats.userName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?"
            if (avatarMeta.url) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarMeta.url} alt="avatar" className="flex-shrink-0 object-cover"
                  style={{ width: 32, height: 32, borderRadius: "50%" }} />
              )
            }
            return (
              <div className="flex-shrink-0 flex items-center justify-center font-semibold text-white"
                style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 13, background: resolveAvatarBackground(avatarMeta) }}>
                {initials}
              </div>
            )
          })()}
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{stats.userName}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{stats.userRole}</p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <ConfirmSignOut />
        )}
      </div>
    </aside>
  )
}
