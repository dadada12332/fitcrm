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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-foreground">403 — Доступ запрещён</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            У вас нет прав администратора платформы. Этот раздел доступен только platform_admin и super_admin.
          </p>
          <Link href={`${base}/login`} className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
            Войти под другим аккаунтом
          </Link>
        </div>
      </div>
    )
  }

  const nav: NavItem[] = [
    { label: "Командный центр", href: base || "/", icon: "LayoutDashboard", section: "Обзор" },
    { label: "Аналитика",      href: `${base}/analytics`,     icon: "BarChart3", section: "Обзор" },
    { label: "Клубы",          href: `${base}/clubs`,         icon: "Building2", section: "Управление" },
    { label: "Пользователи",   href: `${base}/users`,         icon: "Users", section: "Управление" },
    { label: "Тарифы",         href: `${base}/plans`,         icon: "Tag", section: "Управление" },
    { label: "Подписки",       href: `${base}/subscriptions`, icon: "CreditCard", section: "Финансы" },
    { label: "Приём оплат",    href: `${base}/connections`,   icon: "Plug", section: "Финансы" },
    { label: "Платежи",        href: `${base}/payments`,      icon: "Receipt", section: "Финансы" },
    { label: "Мониторинг",     href: `${base}/monitoring`,    icon: "Activity", section: "Система" },
    { label: "Логи",           href: `${base}/logs`,          icon: "ScrollText", section: "Система" },
    { label: "Поддержка",      href: `${base}/support`,       icon: "LifeBuoy", badge: supportAttention || undefined, section: "Коммуникации" },
    { label: "Рассылки",       href: `${base}/broadcasts`,    icon: "Send", section: "Коммуникации" },
    { label: "Промокоды",      href: `${base}/promo`,         icon: "Ticket", section: "Коммуникации" },
    { label: "Настройки",      href: `${base}/settings`,      icon: "Settings", section: "Настройки" },
  ]

  return (
    <PlatformShell base={base} nav={nav} email={auth.email} role={auth.role} appUrl={appUrl}>
      {children}
    </PlatformShell>
  )
}
