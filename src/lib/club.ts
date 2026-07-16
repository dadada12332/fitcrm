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
        const { data: club } = await service.from("clubs").select("name, plan").eq("id", impersonateId).maybeSingle()
        if (club) {
          return {
            clubId: impersonateId,
            role: "owner",
            clubName: club.name,
            plan: club.plan ?? "",
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
    .select("club_id, role, clubs(name, plan)")
    .eq("user_id", uid)
    .eq("is_active", true)

  if (selectedClubId) query = query.eq("club_id", selectedClubId)

  const { data } = await query.limit(1).maybeSingle()

  if (!data) {
    const { data: fallback } = await supabase
      .from("staff")
      .select("club_id, role, clubs(name, plan)")
      .eq("user_id", uid)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (!fallback) return null
    const fb = fallback.clubs as unknown as { name: string; plan: string } | null
    const permissions = await resolvePermissions(supabase, fallback.club_id, fallback.role)
    return { clubId: fallback.club_id, role: fallback.role, clubName: fb?.name ?? "Клуб", plan: fb?.plan ?? "", permissions }
  }

  const club = data.clubs as unknown as { name: string; plan: string } | null
  const permissions = await resolvePermissions(supabase, data.club_id, data.role)
  return { clubId: data.club_id, role: data.role, clubName: club?.name ?? "Клуб", plan: club?.plan ?? "", permissions }
})

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
