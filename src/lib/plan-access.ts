import type { RolePermissions } from "@/lib/permissions"
import type { FeatureKey, FullPlan, LimitKey, SectionKey } from "@/lib/plans"

export type PlanAccess = Pick<FullPlan, "code" | "name" | "features" | "limits" | "sections">

export function planFeatureEnabled(plan: PlanAccess | null, key: FeatureKey): boolean {
  return plan ? plan.features[key] === true : true
}

export function planSectionEnabled(plan: PlanAccess | null, key: SectionKey): boolean {
  return plan ? plan.sections[key] === true : true
}

export function planLimitValue(plan: PlanAccess | null, key: LimitKey): number | null {
  if (!plan) return null
  return plan.limits[key] ?? null
}

export function planLimitError(plan: PlanAccess | null, key: LimitKey, current: number, adding = 1): string | null {
  const limit = planLimitValue(plan, key)
  if (limit === null || current + adding <= limit) return null
  return `Достигнут лимит тарифа «${plan?.name ?? "Текущий"}»: ${limit}. Выберите другой тариф в настройках подписки.`
}

function disabled<T extends Record<string, boolean>>(value: T): T {
  return Object.fromEntries(Object.keys(value).map((key) => [key, false])) as T
}

/** Пересекает права роли с доступом тарифа. Тариф никогда не расширяет права сотрудника. */
export function applyPlanToPermissions(source: RolePermissions, plan: PlanAccess | null): RolePermissions {
  if (!plan) return source
  const result = structuredClone(source)
  const sectionModules: Array<[SectionKey, keyof RolePermissions]> = [
    ["dashboard", "dashboard"], ["clients", "clients"], ["memberships", "memberships"],
    ["payments", "payments"], ["visits", "visits"], ["schedule", "schedule"],
    ["warehouse", "warehouse"], ["reports", "reports"], ["staff", "staff"],
    ["inbox", "inbox"], ["ai", "ai"],
  ]
  for (const [section, permissionModule] of sectionModules) {
    if (!planSectionEnabled(plan, section)) result[permissionModule] = disabled(result[permissionModule]) as never
  }
  if (!planFeatureEnabled(plan, "crm")) {
    for (const permissionModule of ["clients", "memberships", "payments", "visits", "schedule"] as const) {
      result[permissionModule] = disabled(result[permissionModule]) as never
    }
  }
  if (!planFeatureEnabled(plan, "reports")) result.reports = disabled(result.reports)
  if (!planFeatureEnabled(plan, "warehouse")) result.warehouse = disabled(result.warehouse)
  if (!planFeatureEnabled(plan, "inbox")) result.inbox = disabled(result.inbox)
  if (!planFeatureEnabled(plan, "ai")) result.ai = disabled(result.ai)
  if (!planFeatureEnabled(plan, "telegram")) result.telegram = disabled(result.telegram)
  if (!planSectionEnabled(plan, "integrations")) {
    result.settings.integrations = false
    result.telegram = disabled(result.telegram)
  }
  if (!planFeatureEnabled(plan, "finance")) {
    result.dashboard.view_finance = false
    result.payments.view_revenue = false
    result.reports.finance = false
  }
  if (!planFeatureEnabled(plan, "export")) {
    result.clients.export = false
    result.payments.export = false
    result.reports.export = false
  }
  if (!planSectionEnabled(plan, "staff")) result.settings.roles = false
  return result
}
