import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthUser } from "@/lib/auth"
import { cookies } from "next/headers"
import type { RolePermissions } from "@/lib/permissions"
import { getDefaultPermissions } from "@/lib/permissions"

export type CurrentClub = {
  clubId: string
  role: string
  clubName: string
  plan: string
  status: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  permissions: RolePermissions
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
          .select("name, plan, status, trial_expires_at, plan_expires_at")
          .eq("id", impersonateId)
          .maybeSingle()
        if (club) {
          return {
            clubId: impersonateId,
            role: "owner",
            clubName: club.name,
            plan: club.plan ?? "",
            status: club.status ?? "active",
            trialExpiresAt: club.trial_expires_at ?? null,
            planExpiresAt: club.plan_expires_at ?? null,
            permissions: getDefaultPermissions("owner"),
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
    .select("club_id, role, clubs(name, plan, status, trial_expires_at, plan_expires_at)")
    .eq("user_id", uid)
    .eq("is_active", true)

  if (selectedClubId) query = query.eq("club_id", selectedClubId)

  const { data } = await query.limit(1).maybeSingle()

  if (!data) {
    const { data: fallback } = await supabase
      .from("staff")
      .select("club_id, role, clubs(name, plan, status, trial_expires_at, plan_expires_at)")
      .eq("user_id", uid)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (!fallback) return null
    const fb = fallback.clubs as unknown as ClubRow | null
    const permissions = await resolvePermissions(supabase, fallback.club_id, fallback.role)
    return clubResult(fallback.club_id, fallback.role, fb, permissions)
  }

  const club = data.clubs as unknown as ClubRow | null
  const permissions = await resolvePermissions(supabase, data.club_id, data.role)
  return clubResult(data.club_id, data.role, club, permissions)
})

type ClubRow = {
  name: string
  plan: string
  status: string | null
  trial_expires_at: string | null
  plan_expires_at: string | null
}

function clubResult(clubId: string, role: string, club: ClubRow | null, permissions: RolePermissions) {
  return {
    clubId,
    role,
    clubName: club?.name ?? "Клуб",
    plan: club?.plan ?? "",
    status: club?.status ?? "active",
    trialExpiresAt: club?.trial_expires_at ?? null,
    planExpiresAt: club?.plan_expires_at ?? null,
    permissions,
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

  if (data?.permissions) return data.permissions as RolePermissions
  return getDefaultPermissions(role)
}
