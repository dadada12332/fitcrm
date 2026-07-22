import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthUser } from "@/lib/auth"
import { cookies } from "next/headers"
import type { RolePermissions } from "@/lib/permissions"
import { getDefaultPermissions, mergePermissions } from "@/lib/permissions"
import { applyPlanToPermissions, type PlanAccess } from "@/lib/plan-access"

const CLUB_SELECT = "name, plan, status, trial_expires_at, plan_expires_at, plans(code, name, plan_features(feature_key, enabled), plan_limits(limit_key, limit_value), plan_sections(section_key, enabled))"

export type CurrentClub = {
  clubId: string
  role: string
  clubName: string
  plan: string
  status: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  permissions: RolePermissions
  planAccess: PlanAccess | null
  impersonating?: boolean
} | null

export const getCurrentClub = cache(async (userId?: string): Promise<CurrentClub> => {
  const supabase = await createClient()

  let uid = userId
  if (!uid) {
    const user = await getAuthUser()
    if (!user) return null
    uid = user.id
  }

  const cookieStore = await cookies()

  // ── Режим администратора платформы (impersonation) ──
  // Если стоит cookie pa_impersonate И текущий пользователь — админ платформы,
  // загружаем целевой клуб через service-role (bypass RLS) с правами владельца.
  const impersonateId = cookieStore.get("pa_impersonate")?.value
  if (impersonateId) {
    try {
      const service = createServiceClient()
      const { data: u } = await service.from("users").select("platform_role").eq("id", uid).maybeSingle()
      const isAdmin = u?.platform_role === "platform_admin" || u?.platform_role === "super_admin"
      if (isAdmin) {
        const { data: club } = await service
          .from("clubs")
          .select(CLUB_SELECT)
          .eq("id", impersonateId)
          .maybeSingle()
        if (club) {
          const planAccess = embeddedPlanAccess(club.plans)
          return {
            clubId: impersonateId,
            role: "owner",
            clubName: club.name,
            plan: club.plan ?? "",
            status: club.status ?? "active",
            trialExpiresAt: club.trial_expires_at ?? null,
            planExpiresAt: club.plan_expires_at ?? null,
            permissions: applyPlanToPermissions(getDefaultPermissions("owner"), planAccess),
            planAccess,
            impersonating: true,
          }
        }
      }
    } catch {
      // колонка platform_role отсутствует — игнорируем impersonation
    }
  }

  const selectedClubId = cookieStore.get("selected_club_id")?.value

  let query = supabase
    .from("staff")
    .select(`club_id, role, clubs(${CLUB_SELECT})`)
    .eq("user_id", uid)
    .eq("is_active", true)

  if (selectedClubId) query = query.eq("club_id", selectedClubId)

  const { data } = await query.limit(1).maybeSingle()

  if (!data) {
    const { data: fallback } = await supabase
      .from("staff")
      .select(`club_id, role, clubs(${CLUB_SELECT})`)
      .eq("user_id", uid)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (!fallback) return null
    const fb = fallback.clubs as unknown as ClubRow | null
    const permissions = await resolvePermissions(supabase, fallback.club_id, fallback.role)
    const planAccess = embeddedPlanAccess(fb?.plans)
    return clubResult(fallback.club_id, fallback.role, fb, permissions, planAccess)
  }

  const club = data.clubs as unknown as ClubRow | null
  const permissions = await resolvePermissions(supabase, data.club_id, data.role)
  const planAccess = embeddedPlanAccess(club?.plans)
  return clubResult(data.club_id, data.role, club, permissions, planAccess)
})

type ClubRow = {
  name: string
  plan: string
  status: string | null
  trial_expires_at: string | null
  plan_expires_at: string | null
  plans: EmbeddedPlan | null
}

type EmbeddedPlan = {
  code: string
  name: string
  plan_features: Array<{ feature_key: string; enabled: boolean }>
  plan_limits: Array<{ limit_key: string; limit_value: number | null }>
  plan_sections: Array<{ section_key: string; enabled: boolean }>
}

function embeddedPlanAccess(plan: EmbeddedPlan | EmbeddedPlan[] | null | undefined): PlanAccess | null {
  const value = Array.isArray(plan) ? plan[0] : plan
  if (!value) return null
  return {
    code: value.code,
    name: value.name,
    features: Object.fromEntries((value.plan_features ?? []).map((item) => [item.feature_key, item.enabled === true])),
    limits: Object.fromEntries((value.plan_limits ?? []).map((item) => [item.limit_key, item.limit_value === null ? null : Number(item.limit_value)])),
    sections: Object.fromEntries((value.plan_sections ?? []).map((item) => [item.section_key, item.enabled === true])),
  }
}

function clubResult(clubId: string, role: string, club: ClubRow | null, permissions: RolePermissions, planAccess: PlanAccess | null) {
  return {
    clubId,
    role,
    clubName: club?.name ?? "Клуб",
    plan: club?.plan ?? "",
    status: club?.status ?? "active",
    trialExpiresAt: club?.trial_expires_at ?? null,
    planExpiresAt: club?.plan_expires_at ?? null,
    permissions: applyPlanToPermissions(permissions, planAccess),
    planAccess,
  }
}

async function resolvePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  role: string,
): Promise<RolePermissions> {
  // Owner always gets full permissions regardless of DB settings
  if (role === "owner") return getDefaultPermissions("owner")

  const { data } = await supabase
    .from("club_roles")
    .select("permissions")
    .eq("club_id", clubId)
    .eq("key", role)
    .maybeSingle()

  if (data?.permissions) {
    return mergePermissions(
      getDefaultPermissions(role),
      data.permissions as Partial<RolePermissions>,
    )
  }
  return getDefaultPermissions(role)
}
