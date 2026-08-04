import "server-only"

import { createServiceClient } from "@/lib/supabase/service"

export const PLAN_CAPACITY_CHECK_ERROR = "Не удалось проверить лимиты тарифа"

export const PLAN_CAPACITY_LIMIT_KEYS = [
  "clients",
  "staff",
  "branches",
  "products",
  "roles",
  "integrations",
] as const

export type PlanCapacityLimitKey = typeof PLAN_CAPACITY_LIMIT_KEYS[number]
export type PlanCapacityUsage = Record<PlanCapacityLimitKey, number>

type CapacityCountResult = {
  count: number | null
  error: unknown
}

export type PlanCapacityCountResults = {
  clients: CapacityCountResult
  staff: CapacityCountResult
  staffInvitations: CapacityCountResult
  branches: CapacityCountResult
  products: CapacityCountResult
  roles: CapacityCountResult
  telegramIntegrations: CapacityCountResult
  integrationConnections: CapacityCountResult
  accessControlIntegrations: CapacityCountResult
  paymentConnections: CapacityCountResult
}

function readCount(result: CapacityCountResult): number | null {
  if (result.error !== null) return null
  if (!Number.isSafeInteger(result.count) || (result.count ?? -1) < 0) return null
  return result.count
}

/** Converts exact count responses into usage only when every query succeeded. */
export function resolvePlanCapacityUsage(results: PlanCapacityCountResults): PlanCapacityUsage | null {
  const clients = readCount(results.clients)
  const activeStaff = readCount(results.staff)
  const staffInvitations = readCount(results.staffInvitations)
  const branches = readCount(results.branches)
  const products = readCount(results.products)
  const roles = readCount(results.roles)
  const telegramIntegrations = readCount(results.telegramIntegrations)
  const integrationConnections = readCount(results.integrationConnections)
  const accessControlIntegrations = readCount(results.accessControlIntegrations)
  const paymentConnections = readCount(results.paymentConnections)

  if (
    clients === null
    || activeStaff === null
    || staffInvitations === null
    || branches === null
    || products === null
    || roles === null
    || telegramIntegrations === null
    || integrationConnections === null
    || accessControlIntegrations === null
    || paymentConnections === null
  ) return null

  const staff = activeStaff + staffInvitations
  const integrations = telegramIntegrations + integrationConnections + accessControlIntegrations + paymentConnections
  if (!Number.isSafeInteger(staff) || !Number.isSafeInteger(integrations)) return null

  return { clients, staff, branches, products, roles, integrations }
}

export type PlanIdentity = { id: string | null; code: string }

export function requiresPlanCapacityCheck(currentPlan: PlanIdentity, requestedPlan: PlanIdentity): boolean {
  if (currentPlan.id) return currentPlan.id !== requestedPlan.id
  return currentPlan.code !== requestedPlan.code
}

/**
 * Reads capacity with service-role access without returning tenant or owner rows.
 * The owner is resolved from the current club, every club-local query is scoped by
 * that club id, and the only cross-club count is scoped by the resolved owner id.
 */
export async function readPlanCapacityUsage(clubId: string): Promise<PlanCapacityUsage> {
  try {
    if (!clubId) throw new Error(PLAN_CAPACITY_CHECK_ERROR)

    const service = createServiceClient()
    const checkedAt = new Date().toISOString()
    const { data: club, error: clubError } = await service
      .from("clubs")
      .select("owner_id")
      .eq("id", clubId)
      .maybeSingle()

    if (clubError || typeof club?.owner_id !== "string" || !club.owner_id) {
      throw new Error(PLAN_CAPACITY_CHECK_ERROR)
    }

    const [
      clients,
      staff,
      staffInvitations,
      branches,
      products,
      roles,
      telegramIntegrations,
      integrationConnections,
      accessControlIntegrations,
      paymentConnections,
    ] = await Promise.all([
      service.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      service.from("staff").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
      service.from("staff_invitations").select("id", { count: "exact", head: true }).eq("club_id", clubId).is("accepted_at", null).gt("expires_at", checkedAt),
      service.from("clubs").select("id", { count: "exact", head: true }).eq("owner_id", club.owner_id).neq("status", "deleted"),
      service.from("products").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
      service.from("club_roles").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_system", false),
      service.from("telegram_integrations").select("club_id", { count: "exact", head: true }).eq("club_id", clubId),
      service.from("integration_connections").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      service.from("access_control_integrations").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      service.from("payment_connection_requests").select("id", { count: "exact", head: true }).eq("club_id", clubId).in("status", ["new", "active"]),
    ])

    const usage = resolvePlanCapacityUsage({
      clients,
      staff,
      staffInvitations,
      branches,
      products,
      roles,
      telegramIntegrations,
      integrationConnections,
      accessControlIntegrations,
      paymentConnections,
    })
    if (!usage) throw new Error(PLAN_CAPACITY_CHECK_ERROR)
    return usage
  } catch {
    throw new Error(PLAN_CAPACITY_CHECK_ERROR)
  }
}
