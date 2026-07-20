"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, ArrowLeft, Lock, CreditCard, LifeBuoy, LogOut } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { ClubProvider } from "./ClubContext"
import { ProductOnboarding } from "./ProductOnboarding"
import { signOut } from "@/app/(auth)/actions"
import type { SidebarStats } from "@/lib/sidebar"
import type { RolePermissions } from "@/lib/permissions"
import type { ProductOnboardingData } from "@/lib/product-onboarding"

type LockReason = "suspended" | "trial" | "plan" | null

type Props = {
  clubId: string
  clubName: string
  plan: string
  email: string
  stats: SidebarStats
  permissions: RolePermissions
  role: string
  impersonating?: boolean
  lockReason?: LockReason
  productOnboarding: ProductOnboardingData
  children: React.ReactNode
}

const LOCK_COPY: Record<"suspended" | "trial" | "plan", { title: string; text: string }> = {
  suspended: { title: "Клуб заблокирован", text: "Доступ к CRM приостановлен. Свяжитесь с поддержкой FitCRM для разблокировки." },
  trial:     { title: "Пробный период закончился", text: "Чтобы продолжить пользоваться FitCRM, оформите подписку или свяжитесь с поддержкой." },
  plan:      { title: "Подписка истекла", text: "Срок действия тарифа закончился. Продлите подписку, чтобы вернуть доступ к CRM." },
}

function LockScreen({ reason, clubName }: { reason: "suspended" | "trial" | "plan"; clubName: string }) {
  const copy = LOCK_COPY[reason]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#0b1120" }}>
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: reason === "suspended" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", border: `1px solid ${reason === "suspended" ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.35)"}` }}>
          <Lock className="w-8 h-8" style={{ color: reason === "suspended" ? "#f87171" : "#fbbf24" }} />
        </div>
        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "#475569" }}>{clubName}</p>
        <h1 className="text-2xl font-semibold text-white mb-2">{copy.title}</h1>
        <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>{copy.text}</p>
        <div className="flex flex-col gap-2.5">
          {reason !== "suspended" && (
            <Link href="/settings?tab=subscription" className="inline-flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
              <CreditCard className="w-4 h-4" /> Оформить подписку
            </Link>
          )}
          <Link href="/support" className="inline-flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium" style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155" }}>
            <LifeBuoy className="w-4 h-4" /> Написать в поддержку
          </Link>
          <form action={signOut}>
            <button type="submit" className="inline-flex items-center justify-center gap-2 h-10 text-sm w-full" style={{ color: "#64748b" }}>
              <LogOut className="w-3.5 h-3.5" /> Выйти
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ clubId, clubName, plan, email, stats, permissions, role, impersonating, lockReason, productOnboarding, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Разрешённые при блокировке страницы: оплата (подписка) и поддержка — чтобы
  // владелец мог оплатить/написать. Остальное закрыто экраном блокировки.
  const allowWhenLocked = pathname.startsWith("/settings") || pathname.startsWith("/support")
  const showLock = !!lockReason && !allowWhenLocked

  // Route navigation is external state and closes the mobile overlay.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  const handleMenuToggle = () => {
    if (window.innerWidth < 1024) setMobileOpen((v) => !v)
    else setCollapsed((v) => !v)
  }

  const sidebarProps = { clubId, clubName, plan, stats, permissions, role }

  if (showLock && lockReason) {
    return (
      <ClubProvider value={{ clubId, clubName, role, plan, permissions }}>
        <LockScreen reason={lockReason} clubName={clubName} />
      </ClubProvider>
    )
  }

  return (
    <ClubProvider value={{ clubId, clubName, role, plan, permissions }}>
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
      <div className="flex overflow-hidden gap-2 bg-white dark:bg-zinc-950" style={{ height: impersonating ? "calc(100vh - 44px)" : "100vh" }}>

        <ProductOnboarding {...productOnboarding} onMobileSidebarChange={setMobileOpen} />

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 z-0 bg-black/50"
              style={{ backdropFilter: "blur(2px)" }}
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 z-10 p-2 transition-transform" style={{ width: 300 }}>
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
          <TopBar email={email} clubName={clubName} initialNotificationCount={stats.notificationCount} onToggleSidebar={handleMenuToggle} />
          <div className="flex-1 overflow-hidden p-2 lg:pl-0 lg:pt-0">
            <main className="h-full overflow-y-auto rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="p-4 lg:p-5">{children}</div>
            </main>
          </div>
        </div>

      </div>
    </ClubProvider>
  )
}
