"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import type { RolePermissions } from "@/lib/permissions"
import { getDefaultPermissions } from "@/lib/permissions"

export type RoleRow = {
  id: string
  key: string
  name: string
  description: string
  permissions: RolePermissions
  isSystem: boolean
  staffCount: number
}

export async function getRolesAction(): Promise<{ roles: RoleRow[]; error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { roles: [], error: "Клуб не найден" }

  // Ensure default roles exist (lazy creation for older clubs)
  await supabase.rpc("create_default_club_roles", { p_club_id: club.clubId })

  const [rolesRes, staffRes] = await Promise.all([
    supabase.from("club_roles").select("id, key, name, description, permissions, is_system").eq("club_id", club.clubId).order("created_at"),
    supabase.from("staff").select("role").eq("club_id", club.clubId).eq("is_active", true),
  ])

  const staffList = staffRes.data ?? []
  const countByKey: Record<string, number> = {}
  for (const s of staffList) countByKey[s.role] = (countByKey[s.role] ?? 0) + 1

  const roles: RoleRow[] = (rolesRes.data ?? []).map((r: any) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description ?? "",
    permissions: r.permissions as RolePermissions,
    isSystem: r.is_system,
    staffCount: countByKey[r.key] ?? 0,
  }))

  return { roles }
}

export async function saveRoleAction(
  roleId: string,
  data: { name: string; description: string; permissions: RolePermissions },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (club.role !== "owner") return { error: "Только владелец может изменять роли" }

  const { error } = await supabase
    .from("club_roles")
    .update({ name: data.name, description: data.description, permissions: data.permissions })
    .eq("id", roleId)
    .eq("club_id", club.clubId)

  if (error) return { error: error.message }
  return {}
}

export async function createRoleAction(data: {
  name: string
  description: string
  permissions: RolePermissions
  templateKey?: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (club.role !== "owner") return { error: "Только владелец может создавать роли" }

  const key = `custom_${Date.now()}`
  const basePerms = data.templateKey ? getDefaultPermissions(data.templateKey) : getDefaultPermissions("trainer")
  const permissions = data.permissions ?? basePerms

  const { data: row, error } = await supabase
    .from("club_roles")
    .insert({ club_id: club.clubId, key, name: data.name, description: data.description, permissions, is_system: false })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { id: row.id }
}

export async function deleteRoleAction(roleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (club.role !== "owner") return { error: "Только владелец может удалять роли" }

  // Check if any staff uses this role
  const { data: role } = await supabase.from("club_roles").select("key, is_system").eq("id", roleId).eq("club_id", club.clubId).single()
  if (!role) return { error: "Роль не найдена" }
  if (role.is_system) return { error: "Системные роли нельзя удалить" }

  const { count } = await supabase.from("staff").select("*", { count: "exact", head: true }).eq("club_id", club.clubId).eq("role", role.key)
  if (count && count > 0) return { error: `Роль используется ${count} сотрудниками. Сначала измените их роль.` }

  const { error } = await supabase.from("club_roles").delete().eq("id", roleId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  return {}
}
