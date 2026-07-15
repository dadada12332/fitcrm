import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { getPlatformAuth, platformBase } from "@/lib/platform"
import { createServiceClient } from "@/lib/supabase/service"
import { PlatformShell, type NavItem } from "@/components/platform/PlatformShell"

export const dynamic = "force-dynamic"

async function countSupportAttention(): Promise<number> {
  try {
    const db = createServiceClient()
    const { data } = await db.from("support_tickets").select("last_message_at, agent_last_read_at").neq("status", "closed")
    return (data ?? []).filter((t) => !t.agent_last_read_at || new Date(t.last_message_at) > new Date(t.agent_last_read_at)).length
  } catch { return 0 }
}

export default async function PlatformProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await getPlatformAuth()
  const base = await platformBase()
  const supportAttention = auth ? await countSupportAttention() : 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fitcrm.uz"

  // 403 — не администратор платформы.
  if (!auth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #0b1120 55%)", fontFamily: "var(--font-sans)" }}
      >
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)" }}>
            <ShieldAlert className="w-7 h-7" style={{ color: "#f87171" }} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">403 — Доступ запрещён</h1>
          <p className="text-sm mb-6" style={{ color: "#64748b" }}>
            У вас нет прав администратора платформы. Этот раздел доступен только platform_admin и super_admin.
          </p>
          <Link href={`${base}/login`} className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)" }}>
            Войти под другим аккаунтом
          </Link>
        </div>
      </div>
    )
  }

  const nav: NavItem[] = [
    { label: "Командный центр", href: base || "/", icon: "LayoutDashboard" },
    { label: "Клубы",          href: `${base}/clubs`,         icon: "Building2" },
    { label: "Пользователи",   href: `${base}/users`,         icon: "Users" },
    { label: "Тарифы",         href: `${base}/plans`,         icon: "Tag" },
    { label: "Подписки",       href: `${base}/subscriptions`, icon: "CreditCard" },
    { label: "Приём оплат",    href: `${base}/connections`,   icon: "Plug" },
    { label: "Платежи",        href: `${base}/payments`,      icon: "Receipt" },
    { label: "Аналитика",      href: `${base}/analytics`,     icon: "BarChart3" },
    { label: "Мониторинг",     href: `${base}/monitoring`,    icon: "Activity" },
    { label: "Логи",           href: `${base}/logs`,          icon: "ScrollText" },
    { label: "Поддержка",      href: `${base}/support`,       icon: "LifeBuoy", badge: supportAttention || undefined },
    { label: "Рассылки",       href: `${base}/broadcasts`,    icon: "Send" },
    { label: "Промокоды",      href: `${base}/promo`,         icon: "Ticket" },
    { label: "Настройки",      href: `${base}/settings`,      icon: "Settings" },
  ]

  return (
    <PlatformShell base={base} nav={nav} email={auth.email} role={auth.role} appUrl={appUrl}>
      {children}
    </PlatformShell>
  )
}
