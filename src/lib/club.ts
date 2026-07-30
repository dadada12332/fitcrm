import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthUser } from "@/lib/auth"
import { cookies } from "next/headers"
import type { RolePermissions, StaffPermissionOverrides } from "@/lib/permissions"
import { applyStaffPermissionOverrides, getDefaultPermissions, mergePermissions } from "@/lib/permissions"
import { applyPlanToPermissions, type PlanAccess } from "@/lib/plan-access"
import { normalizeAppLocale, type AppLocale } from "@/lib/app-locale"

const CLUB_SELECT = "name, plan, status, trial_expires_at, plan_expires_at, settings, plans(code, name, plan_features(feature_key, enabled), plan_limits(limit_key, limit_value), plan_sections(section_key, enabled))"

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
  locale: AppLocale
  currency: string
  timezone: string
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
            locale: normalizeAppLocale((club.settings as Record<string, unknown> | null)?.locale),
            currency: String((club.settings as Record<string, unknown> | null)?.currency ?? "UZS"),
            timezone: String((club.settings as Record<string, unknown> | null)?.timezone ?? "Asia/Tashkent"),
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
    const staffSettings = await resolveStaffSettings(uid, fallback.club_id)
    const permissions = await resolvePermissions(
      supabase,
      fallback.club_id,
      fallback.role,
      staffSettings.permissions,
    )
    const planAccess = embeddedPlanAccess(fb?.plans)
    return clubResult(fallback.club_id, fallback.role, fb, permissions, planAccess, staffSettings.locale)
  }

  const club = data.clubs as unknown as ClubRow | null
  const staffSettings = await resolveStaffSettings(uid, data.club_id)
  const permissions = await resolvePermissions(
    supabase,
    data.club_id,
    data.role,
    staffSettings.permissions,
  )
  const planAccess = embeddedPlanAccess(club?.plans)
  return clubResult(data.club_id, data.role, club, permissions, planAccess, staffSettings.locale)
})

type ClubRow = {
  name: string
  plan: string
  status: string | null
  trial_expires_at: string | null
  plan_expires_at: string | null
  settings: Record<string, unknown> | null
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

function clubResult(
  clubId: string,
  role: string,
  club: ClubRow | null,
  permissions: RolePermissions,
  planAccess: PlanAccess | null,
  staffLocale?: unknown,
) {
  const clubSettings = club?.settings ?? {}
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
    locale: normalizeAppLocale(staffLocale ?? clubSettings.locale),
    currency: String(clubSettings.currency ?? "UZS"),
    timezone: String(clubSettings.timezone ?? "Asia/Tashkent"),
  }
}

type ResolvedStaffSettings = {
  locale?: unknown
  permissions?: StaffPermissionOverrides
}

async function resolveStaffSettings(userId: string, clubId: string): Promise<ResolvedStaffSettings> {
  // `staff.settings` is intentionally unavailable through the authenticated
  // Data API because it can contain private staff metadata. The RLS-scoped
  // membership query above resolves the tenant first; this service-role read
  // stays scoped to that user and club and returns only the locale.
  try {
    const service = createServiceClient()
    const { data } = await service
      .from("staff")
      .select("settings")
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .maybeSingle()
    const settings = (data?.settings as Record<string, unknown> | null) ?? {}
    return {
      locale: settings.locale,
      permissions: settings.permissions as StaffPermissionOverrides | undefined,
    }
  } catch {
    return {}
  }
}

async function resolvePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  role: string,
  staffOverrides?: StaffPermissionOverrides,
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
    return applyStaffPermissionOverrides(
      mergePermissions(
        getDefaultPermissions(role),
        data.permissions as Partial<RolePermissions>,
      ),
      staffOverrides,
    )
  }
  return applyStaffPermissionOverrides(getDefaultPermissions(role), staffOverrides)
}
