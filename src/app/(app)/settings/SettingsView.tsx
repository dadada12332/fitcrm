import { redirect } from "next/navigation"
import { getCurrentClubForRecovery } from "@/lib/club"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlans, planBenefits } from "@/lib/plans"
import { SettingsShell } from "./SettingsShell"
import { getRolesAction, type RoleRow } from "./roles/actions"
import type { ClubData, PlanForClient, PlanUsageForClient } from "@/components/app/ClubSettings"
import { planFeatureEnabled } from "@/lib/plan-access"
import { resolvePlatformSubscription } from "@/lib/platform-subscription"
import { PLAN_CAPACITY_CHECK_ERROR, readPlanCapacityUsage } from "@/lib/plan-capacity"

/**
 * Общий рендер настроек. Используется и главной /settings, и под-роутами
 * (/settings/club, /settings/roles, ...). Раньше под-роуты делали redirect на
 * /settings?tab=X — клиентская навигация на redirect-страницу рассинхронизировала
 * хуки Next Router (React #310). Теперь под-роуты рендерят этот компонент напрямую,
 * без редиректа.
 */
export async function SettingsView({ tab, staffId, staffName }: { tab?: string; staffId?: string; staffName?: string }) {
  const club = await getCurrentClubForRecovery()
  if (!club) redirect("/onboarding")

  // Stable server timestamp shared by lifecycle copy and the client render.
  // eslint-disable-next-line react-hooks/purity
  const generatedAt = Date.now()
  const subscriptionState = resolvePlatformSubscription({
    plan: club.plan,
    status: club.status,
    trialExpiresAt: club.trialExpiresAt,
    planExpiresAt: club.planExpiresAt,
    now: generatedAt,
  })
  const subscriptionOnly = !club.impersonating
    && subscriptionState.isLocked
    && subscriptionState.kind !== "suspended"

  const allowedTabs = {
    club:          !subscriptionOnly && club.permissions.settings.general,
    branches:      !subscriptionOnly && club.role === "owner" && planFeatureEnabled(club.planAccess, "multi_branch"),
    staff:         !subscriptionOnly && club.permissions.staff.view,
    finance:       !subscriptionOnly && club.permissions.settings.general && planFeatureEnabled(club.planAccess, "finance"),
    notifications: !subscriptionOnly && club.permissions.telegram.manage && planFeatureEnabled(club.planAccess, "telegram_automation"),
    integrations:  !subscriptionOnly && club.permissions.settings.integrations,
    roles:         !subscriptionOnly && club.permissions.settings.roles,
    subscription:  club.permissions.settings.subscription,
  }

  const service = createServiceClient()
  const clubSelect = allowedTabs.staff
    ? "id, name, plan_id, plan, trial_expires_at, plan_expires_at, plan_price_locked, plan_currency_locked, plan_period_locked, settings, staff!inner(id, role, user_id, is_active, users(id, email, full_name))"
    : "id, name, plan_id, plan, trial_expires_at, plan_expires_at, plan_price_locked, plan_currency_locked, plan_period_locked, settings"
  const [clubResult, user, pendingResult, connectionsResult, dbPlans, rolesResult, capacityResult, compensationResult] = await Promise.all([
    service
      .from("clubs")
      .select(clubSelect)
      .eq("id", club.clubId)
      .single(),
    allowedTabs.staff ? getAuthUser() : Promise.resolve(null),
    allowedTabs.subscription ? service
      .from("platform_billing_requests")
      .select("plan, months, amount, quoted_currency, created_at")
      .eq("club_id", club.clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() : Promise.resolve({ data: null }),
    allowedTabs.integrations ? service
      .from("payment_connection_requests")
      .select("provider, status, created_at")
      .eq("club_id", club.clubId)
      .in("status", ["new", "active"])
      .order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    allowedTabs.subscription ? getPlans({ includeArchived: true }).catch(() => []) : Promise.resolve([]),
    tab === "roles" && allowedTabs.roles ? getRolesAction() : Promise.resolve({ roles: [] as RoleRow[], error: undefined }),
    allowedTabs.subscription
      ? readPlanCapacityUsage(club.clubId)
        .then((usage) => ({ usage, error: null }))
        .catch(() => ({ usage: null, error: PLAN_CAPACITY_CHECK_ERROR }))
      : Promise.resolve({ usage: null, error: null }),
    allowedTabs.subscription
      ? service.from("platform_club_compensations")
        .select("id, value, reason, expires_at")
        .eq("club_id", club.clubId)
        .eq("benefit_type", "discount_pct")
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("value", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const clubRow = clubResult.data
  const capacityUsage = capacityResult.usage

  if (!clubRow) redirect("/dashboard")

  const userId = user?.id

  const planUsage: PlanUsageForClient[] = []
  if (allowedTabs.subscription) {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    const periodStart = monthStart.toISOString().slice(0, 10)
    const { data: monthlyUsage } = await service
      .from("plan_usage")
      .select("usage_key, used")
      .eq("club_id", club.clubId)
      .eq("period_start", periodStart)

    const monthly = new Map((monthlyUsage ?? []).map((item) => [item.usage_key, Number(item.used)]))
    if (capacityUsage) {
      planUsage.push(
        { key: "clients", used: capacityUsage.clients },
        { key: "staff", used: capacityUsage.staff },
        { key: "branches", used: capacityUsage.branches },
        { key: "products", used: capacityUsage.products },
        { key: "roles", used: capacityUsage.roles },
        { key: "integrations", used: capacityUsage.integrations },
      )
    }
    planUsage.push(
      { key: "ai_requests", used: monthly.get("ai_requests") ?? 0 },
      { key: "telegram_messages", used: monthly.get("telegram_messages") ?? 0 },
      { key: "imports", used: monthly.get("imports") ?? 0 },
      { key: "exports", used: monthly.get("exports") ?? 0 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffList = (allowedTabs.staff ? ((clubRow as any).staff ?? []) : [])
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
    ? {
      plan: pending.plan,
      months: pending.months,
      amount: pending.amount,
      currency: pending.quoted_currency,
      createdAt: pending.created_at,
    }
    : null

  // Статус подключения платёжек (Payme / Click).
  const paymentConnections: Record<string, "new" | "active"> = {}
  for (const r of (connectionsResult.data ?? []) as { provider: string; status: "new" | "active" }[]) {
    if (!paymentConnections[r.provider]) paymentConnections[r.provider] = r.status
    if (r.status === "active") paymentConnections[r.provider] = "active"
  }

  // Тарифы из БД (раздел «Тарифы» Platform Admin) — без хардкода цен/лимитов в CRM.
  const plansForClient: PlanForClient[] = dbPlans.filter((p) => p.period === "monthly").map((p) => ({
    id: p.id, code: p.code, name: p.name, price: p.price, currency: p.currency, period: p.period,
    isTrial: p.is_trial, isActive: p.is_active && !p.is_archived,
    isPopular: p.is_popular || p.is_recommended, color: p.color,
    subtitle: p.short_description || p.landing_subtitle, benefits: planBenefits(p),
    clients: p.limits.clients ?? null, staff: p.limits.staff ?? null, limits: p.limits,
  }))

  const data: ClubData = {
    // Server-side request timestamp, stable for this settings render.
    generatedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: (clubRow as any).id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (clubRow as any).name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planId: (clubRow as any).plan_id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan: club.plan || (clubRow as any).plan || "trial",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planCurrencyLocked: (clubRow as any).plan_currency_locked ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    planPeriodLocked: (clubRow as any).plan_period_locked ?? null,
    clientCount: capacityUsage?.clients ?? 0,
    planCapacityError: capacityResult.error,
    planUsage,
    subscriptionState,
    activeCompensation: compensationResult.data
      ? {
        id: compensationResult.data.id,
        discountPct: Number(compensationResult.data.value),
        reason: compensationResult.data.reason,
        expiresAt: compensationResult.data.expires_at,
      }
      : null,
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
