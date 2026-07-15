import { redirect } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { createClient } from "@/lib/supabase/server"
import { getPlans, planBenefits } from "@/lib/plans"
import { SettingsShell } from "./SettingsShell"
import type { ClubData, PlanForClient } from "@/components/app/ClubSettings"

/**
 * Общий рендер настроек. Используется и главной /settings, и под-роутами
 * (/settings/club, /settings/roles, ...). Раньше под-роуты делали redirect на
 * /settings?tab=X — клиентская навигация на redirect-страницу рассинхронизировала
 * хуки Next Router (React #310). Теперь под-роуты рендерят этот компонент напрямую,
 * без редиректа.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function SettingsView({ tab, staffId, staffName }: { tab?: string; staffId?: string; staffName?: string }) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  const { data: clubRow } = await supabase
    .from("clubs")
    .select("id, name, plan, trial_expires_at, plan_expires_at, plan_price_locked, settings, staff!inner(id, role, user_id, is_active, users(id, email, full_name))")
    .eq("id", club.clubId)
    .single()

  if (!clubRow) redirect("/dashboard")

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffList = ((clubRow as any).staff ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => s.is_active)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = s.users as any
      return {
        id: s.id,
        name: u?.full_name ?? u?.email?.split("@")[0] ?? "—",
        role: s.role,
        email: u?.email ?? "",
        isMe: s.user_id === userId,
      }
    })

  // Активная заявка на подписку (для раздела «Подписка»).
  let pendingRequest: ClubData["pendingRequest"] = null
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const { data: pr } = await svc
      .from("platform_billing_requests")
      .select("plan, months, amount, created_at")
      .eq("club_id", club.clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pr) pendingRequest = { plan: pr.plan, months: pr.months, amount: pr.amount, createdAt: pr.created_at }
  } catch { /* таблица ещё не создана */ }

  // Статус подключения платёжек (Payme / Click).
  const paymentConnections: Record<string, "new" | "active"> = {}
  try {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    const { data: pcr } = await svc
      .from("payment_connection_requests")
      .select("provider, status, created_at")
      .eq("club_id", club.clubId)
      .in("status", ["new", "active"])
      .order("created_at", { ascending: false })
    for (const r of (pcr ?? []) as { provider: string; status: "new" | "active" }[]) {
      // active важнее new; берём первый (самый свежий) статус на провайдер
      if (!paymentConnections[r.provider]) paymentConnections[r.provider] = r.status
      if (r.status === "active") paymentConnections[r.provider] = "active"
    }
  } catch { /* таблица ещё не создана */ }

  // Тарифы из БД (раздел «Тарифы» Platform Admin) — без хардкода цен/лимитов в CRM.
  let plansForClient: PlanForClient[] = []
  try {
    const dbPlans = await getPlans({ includeArchived: true }) // включаем архивные, чтобы показать текущий тариф клуба
    plansForClient = dbPlans.map((p) => ({
      code: p.code, name: p.name, price: p.price, currency: p.currency, period: p.period,
      isTrial: p.is_trial, isActive: p.is_active && !p.is_archived,
      isPopular: p.is_popular || p.is_recommended, color: p.color,
      subtitle: p.short_description || p.landing_subtitle, benefits: planBenefits(p),
      clients: p.limits.clients ?? null, staff: p.limits.staff ?? null,
    }))
  } catch { /* тарифы ещё не настроены */ }

  const data: ClubData = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: (clubRow as any).id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (clubRow as any).name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan: (clubRow as any).plan ?? "trial",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trialExpiresAt: (clubRow as any).trial_expires_at ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planExpiresAt: (clubRow as any).plan_expires_at ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings: ((clubRow as any).settings as ClubData["settings"]) ?? {},
    currentRole: club.role,
    staffList,
    pendingRequest,
    plans: plansForClient,
    paymentConnections,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planPriceLocked: (clubRow as any).plan_price_locked ?? null,
  }

  const allowedTabs = {
    club:          club.permissions.settings.general,
    branches:      club.role === "owner",
    staff:         club.permissions.staff.view,
    finance:       club.permissions.settings.general,
    notifications: club.permissions.settings.general,
    integrations:  club.permissions.settings.integrations,
    roles:         club.permissions.settings.roles,
    security:      true,
    subscription:  club.permissions.settings.subscription,
  }

  return (
    <SettingsShell
      data={data}
      allowedTabs={allowedTabs}
      isOwner={club.role === "owner"}
      initialTab={tab}
      initialAssignStaffId={staffId}
      initialAssignStaffName={staffName ? decodeURIComponent(staffName) : undefined}
    />
  )
}
