import { redirect } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { getAuthUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlans, planBenefits } from "@/lib/plans"
import { SettingsShell } from "./SettingsShell"
import { getRolesAction, type RoleRow } from "./roles/actions"
import type { ClubData, PlanForClient } from "@/components/app/ClubSettings"
import { planFeatureEnabled } from "@/lib/plan-access"

/**
 * Общий рендер настроек. Используется и главной /settings, и под-роутами
 * (/settings/club, /settings/roles, ...). Раньше под-роуты делали redirect на
 * /settings?tab=X — клиентская навигация на redirect-страницу рассинхронизировала
 * хуки Next Router (React #310). Теперь под-роуты рендерят этот компонент напрямую,
 * без редиректа.
 */
export async function SettingsView({ tab, staffId, staffName }: { tab?: string; staffId?: string; staffName?: string }) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")

  const service = createServiceClient()
  const [clubResult, user, pendingResult, connectionsResult, dbPlans, rolesResult, clientsResult] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, plan, trial_expires_at, plan_expires_at, plan_price_locked, settings, staff!inner(id, role, user_id, is_active, users(id, email, full_name))")
      .eq("id", club.clubId)
      .single(),
    getAuthUser(),
    service
      .from("platform_billing_requests")
      .select("plan, months, amount, created_at")
      .eq("club_id", club.clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("payment_connection_requests")
      .select("provider, status, created_at")
      .eq("club_id", club.clubId)
      .in("status", ["new", "active"])
      .order("created_at", { ascending: false }),
    getPlans({ includeArchived: true }).catch(() => []),
    tab === "roles" ? getRolesAction() : Promise.resolve({ roles: [] as RoleRow[], error: undefined }),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", club.clubId),
  ])
  const clubRow = clubResult.data

  if (!clubRow) redirect("/dashboard")

  const userId = user?.id

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
  const pending = pendingResult.data
  const pendingRequest: ClubData["pendingRequest"] = pending
    ? { plan: pending.plan, months: pending.months, amount: pending.amount, createdAt: pending.created_at }
    : null

  // Статус подключения платёжек (Payme / Click).
  const paymentConnections: Record<string, "new" | "active"> = {}
  for (const r of (connectionsResult.data ?? []) as { provider: string; status: "new" | "active" }[]) {
    if (!paymentConnections[r.provider]) paymentConnections[r.provider] = r.status
    if (r.status === "active") paymentConnections[r.provider] = "active"
  }

  // Тарифы из БД (раздел «Тарифы» Platform Admin) — без хардкода цен/лимитов в CRM.
  const plansForClient: PlanForClient[] = dbPlans.map((p) => ({
    code: p.code, name: p.name, price: p.price, currency: p.currency, period: p.period,
    isTrial: p.is_trial, isActive: p.is_active && !p.is_archived,
    isPopular: p.is_popular || p.is_recommended, color: p.color,
    subtitle: p.short_description || p.landing_subtitle, benefits: planBenefits(p),
    clients: p.limits.clients ?? null, staff: p.limits.staff ?? null,
  }))

  const data: ClubData = {
    // Server-side request timestamp, stable for this settings render.
    // eslint-disable-next-line react-hooks/purity
    generatedAt: Date.now(),
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
    clientCount: clientsResult.count ?? 0,
  }

  const allowedTabs = {
    club:          club.permissions.settings.general,
    branches:      club.role === "owner" && planFeatureEnabled(club.planAccess, "multi_branch"),
    staff:         club.permissions.staff.view,
    finance:       club.permissions.settings.general && planFeatureEnabled(club.planAccess, "finance"),
    notifications: club.permissions.telegram.manage && planFeatureEnabled(club.planAccess, "telegram_automation"),
    integrations:  club.permissions.settings.integrations,
    roles:         club.permissions.settings.roles,
    security:      true,
    subscription:  club.permissions.settings.subscription,
  }

  const initialRoles = tab === "roles" ? rolesResult.roles : undefined
  const initialRolesError = tab === "roles" ? rolesResult.error : undefined

  return (
    <SettingsShell
      data={data}
      allowedTabs={allowedTabs}
      isOwner={club.role === "owner"}
      initialTab={tab}
      initialAssignStaffId={staffId}
      initialAssignStaffName={staffName ? decodeURIComponent(staffName) : undefined}
      initialRoles={initialRoles}
      initialRolesError={initialRolesError}
    />
  )
}
