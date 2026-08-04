"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, ArrowLeft, Lock, CreditCard, LifeBuoy, LogOut, X, AlertTriangle, ArrowRight } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { ClubProvider } from "./ClubContext"
import { ProductOnboarding } from "./ProductOnboarding"
import { PlanLimitUpgradeDialog } from "./PlanLimitUpgradeDialog"
import { AppTranslationLayer } from "./AppTranslationLayer"
import { signOut } from "@/app/(auth)/actions"
import type { SidebarStats } from "@/lib/sidebar"
import type { RolePermissions } from "@/lib/permissions"
import type { ProductOnboardingData } from "@/lib/product-onboarding"
import type { PlanAccess } from "@/lib/plan-access"
import type { AppLocale } from "@/lib/app-locale"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PlatformSubscriptionState } from "@/lib/platform-subscription"

type LockReason = "suspended" | "trial" | "plan" | null

type Props = {
  clubId: string
  clubName: string
  plan: string
  email: string
  stats: SidebarStats
  permissions: RolePermissions
  planAccess: PlanAccess | null
  locale: AppLocale
  currency: string
  timezone: string
  role: string
  impersonating?: boolean
  lockReason?: LockReason
  subscriptionState: PlatformSubscriptionState
  canManageSubscription: boolean
  productOnboarding: ProductOnboardingData
  recoveryOnly?: boolean
  children: React.ReactNode
}

const LOCK_COPY: Record<"suspended" | "trial" | "plan", { title: string; text: string }> = {
  suspended: { title: "Клуб заблокирован", text: "Доступ к CRM приостановлен. Свяжитесь с поддержкой Zalkins для разблокировки." },
  trial:     { title: "Пробный период закончился", text: "Чтобы продолжить пользоваться Zalkins, оформите подписку или свяжитесь с поддержкой." },
  plan:      { title: "Подписка истекла", text: "Срок действия тарифа закончился. Продлите подписку, чтобы вернуть доступ к CRM." },
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Пробный",
  starter: "Starter",
  standard: "Standard",
  business: "Business",
}

function LockScreen({
  reason,
  clubName,
  plan,
  canManageSubscription,
}: {
  reason: "suspended" | "trial" | "plan"
  clubName: string
  plan: string
  canManageSubscription: boolean
}) {
  const copy = LOCK_COPY[reason]
  const renewalLabel = reason === "trial"
    ? "Выбрать тариф"
    : `Продлить ${PLAN_LABELS[plan] ?? plan}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
        <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border ${
          reason === "suspended"
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-brand/25 bg-brand/10 text-brand"
        }`}>
          <Lock className="size-8" />
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{clubName}</p>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mb-8 text-sm leading-6 text-muted-foreground">
          {copy.text}
          {!canManageSubscription && reason !== "suspended" ? " Владелец клуба уже может отправить заявку на продление." : ""}
        </p>
        <div className="flex flex-col gap-2.5">
          {reason !== "suspended" && canManageSubscription && (
            <Link href="/settings/subscription" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2")}>
              <CreditCard className="size-4" /> {renewalLabel}
            </Link>
          )}
          <Link href="/support" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 gap-2")}>
            <LifeBuoy className="size-4" /> Написать в поддержку
          </Link>
          <form action={signOut}>
            <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <LogOut className="size-3.5" /> Выйти
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function SubscriptionNotice({
  state,
  plan,
  timeZone,
  canManageSubscription,
}: {
  state: PlatformSubscriptionState
  plan: string
  timeZone: string
  canManageSubscription: boolean
}) {
  if (!state.isExpiring) return null
  const date = state.expiresAt
    ? new Date(state.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone })
    : null
  const isTrial = state.isTrial
  return (
    <div className="shrink-0 border-b border-brand/20 bg-brand/5 px-4 py-2.5 lg:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand sm:mt-0" />
          <p className="text-sm text-foreground">
            <span className="font-medium">
              {isTrial ? "Пробный период" : `Подписка ${PLAN_LABELS[plan] ?? plan}`}
              {state.daysLeft === 1 ? " закончится завтра" : ` истекает через ${state.daysLeft} дн.`}
            </span>
            {date ? <span className="text-muted-foreground"> · {date}</span> : null}
            {!canManageSubscription ? <span className="text-muted-foreground"> · владелец клуба уведомлён</span> : null}
          </p>
        </div>
        {canManageSubscription && (
          <Link href="/settings/subscription" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline sm:ml-auto">
            {isTrial ? "Выбрать тариф" : "Продлить заранее"}<ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

export function AppShell({ clubId, clubName, plan, email, stats, permissions, planAccess, locale, currency, timezone, role, impersonating, lockReason, subscriptionState, canManageSubscription, productOnboarding, recoveryOnly = false, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const pathname = usePathname()

  // Разрешённые при блокировке страницы: оплата (подписка) и поддержка — чтобы
  // владелец мог оплатить/написать. Остальное закрыто экраном блокировки.
  const subscriptionRoute = pathname === "/settings/subscription" || pathname.startsWith("/settings/subscription/")
  const supportRoute = pathname === "/support" || pathname.startsWith("/support/")
  const allowWhenLocked = supportRoute
    || (lockReason !== "suspended" && canManageSubscription && subscriptionRoute)
  const showLock = !!lockReason && !allowWhenLocked

  // Route navigation is external state and closes the mobile overlay.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (!mobileOpen) return
    const drawer = drawerRef.current
    if (!drawer) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusable = () => Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden"))
    ;(focusable()[0] ?? drawer).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const items = focusable()
      if (!items.length) {
        event.preventDefault()
        drawer.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [mobileOpen])

  const handleMenuToggle = () => {
    if (window.innerWidth < 1024) {
      if (!mobileOpen) previousFocusRef.current = document.activeElement as HTMLElement | null
      setMobileOpen((v) => !v)
    }
    else setCollapsed((v) => !v)
  }

  const sidebarProps = {
    clubId,
    clubName,
    plan,
    stats,
    permissions,
    planAccess,
    role,
    subscriptionState,
    bypassSubscriptionLock: Boolean(impersonating),
  }

  if (showLock && lockReason) {
    return (
      <ClubProvider value={{ clubId, clubName, role, plan, permissions, planAccess, locale, currency, timezone }}>
        <AppTranslationLayer locale={locale} />
        <LockScreen reason={lockReason} clubName={clubName} plan={plan} canManageSubscription={canManageSubscription} />
      </ClubProvider>
    )
  }

  return (
    <ClubProvider value={{ clubId, clubName, role, plan, permissions, planAccess, locale, currency, timezone }}>
      <AppTranslationLayer locale={locale} />
      {!recoveryOnly && <PlanLimitUpgradeDialog />}
      <div className="flex h-dvh flex-col overflow-hidden">
      {impersonating && (
        <div
          className="flex items-center gap-3 px-4 h-11 shrink-0"
          style={{ background: "linear-gradient(90deg,#4338ca,#6366f1)", color: "white" }}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">Platform Admin Mode</span>
          <span className="text-sm hidden sm:inline" style={{ color: "rgba(255,255,255,0.85)" }}>
            · Клуб: <b>{clubName}</b> · Все действия логируются
          </span>
          <a
            href="/api/platform/stop-impersonation"
            className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Вернуться в Platform
          </a>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden gap-2 bg-white dark:bg-zinc-950">

        {!recoveryOnly && <ProductOnboarding {...productOnboarding} onMobileSidebarChange={setMobileOpen} />}

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Закрыть меню"
              className="absolute inset-0 z-0 bg-black/50"
              style={{ backdropFilter: "blur(2px)" }}
              onClick={() => setMobileOpen(false)}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Навигация CRM"
              tabIndex={-1}
              className="absolute bottom-0 left-0 top-0 z-10 p-2 outline-none transition-transform"
              style={{ width: 300 }}
            >
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Закрыть меню"
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-4 z-20 shadow-sm"
              >
                <X className="size-4" />
              </Button>
              <Sidebar {...sidebarProps} collapsed={false} mobile />
            </div>
          </div>
        )}

        <div
          className="hidden lg:flex flex-shrink-0 transition-all duration-200"
          style={{ width: collapsed ? 72 : 300, padding: "8px 0 8px 8px" }}
        >
          <Sidebar {...sidebarProps} collapsed={collapsed} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar email={email} clubName={clubName} initialNotificationCount={stats.notificationCount} onToggleSidebar={handleMenuToggle} recoveryOnly={recoveryOnly} />
          {!impersonating && (
            <SubscriptionNotice state={subscriptionState} plan={plan} timeZone={timezone} canManageSubscription={canManageSubscription} />
          )}
          <div className="flex-1 overflow-hidden p-2 lg:pl-0 lg:pt-0">
            <main className="h-full overflow-y-auto rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="p-4 lg:p-5">{children}</div>
            </main>
          </div>
        </div>

      </div>
      </div>
    </ClubProvider>
  )
}
