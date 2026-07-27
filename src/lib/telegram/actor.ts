import { createServiceClient } from "@/lib/supabase/service"
import {
  getDefaultPermissions,
  mergePermissions,
  type RolePermissions,
} from "@/lib/permissions"
import { applyPlanToPermissions } from "@/lib/plan-access"
import { getPlanAccessByCode } from "@/lib/plans"

type TelegramIdentity = {
  clubId: string
  telegramId: number
  preferences: { expiry_reminders?: boolean; schedule_reminders?: boolean }
}

export type TelegramClientActor = TelegramIdentity & {
  kind: "client"
  clientId: string
  fullName: string
}

export type TelegramStaffActor = TelegramIdentity & {
  kind: "staff"
  staffId: string
  role: string
  roleName: string
  fullName: string
  permissions: RolePermissions
}

export type TelegramActor = TelegramClientActor | TelegramStaffActor

export async function resolveTelegramActor(
  clubId: string,
  telegramId: number,
): Promise<TelegramActor | null> {
  const service = createServiceClient()
  const { data: link } = await service
    .from("telegram_users")
    .select("client_id, staff_id, preferences")
    .eq("club_id", clubId)
    .eq("telegram_id", telegramId)
    .maybeSingle()

  if (!link) return null
  const preferences = (link.preferences as TelegramIdentity["preferences"] | null) ?? {}

  if (link.staff_id) {
    const { data: staff } = await service
      .from("staff")
      .select("id, role, settings")
      .eq("id", link.staff_id)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .maybeSingle()
    if (!staff) return null

    const [{ data: roleRow }, { data: club }] = await Promise.all([
      service
        .from("club_roles")
        .select("name, permissions")
        .eq("club_id", clubId)
        .eq("key", staff.role)
        .maybeSingle(),
      service
        .from("clubs")
        .select("plan")
        .eq("id", clubId)
        .maybeSingle(),
    ])
    const base = getDefaultPermissions(staff.role)
    const rolePermissions = staff.role === "owner"
      ? getDefaultPermissions("owner")
      : mergePermissions(
          base,
          (roleRow?.permissions as Partial<RolePermissions> | null) ?? {},
        )
    const planAccess = await getPlanAccessByCode(club?.plan ?? "")
    const permissions = applyPlanToPermissions(rolePermissions, planAccess)
    const settings = (staff.settings as { full_name?: string } | null) ?? {}

    return {
      kind: "staff",
      clubId,
      telegramId,
      staffId: staff.id,
      role: staff.role,
      roleName: roleRow?.name ?? staff.role,
      fullName: settings.full_name?.trim() || roleRow?.name || "Сотрудник",
      permissions,
      preferences,
    }
  }

  if (link.client_id) {
    const { data: client } = await service
      .from("clients")
      .select("id, full_name")
      .eq("id", link.client_id)
      .eq("club_id", clubId)
      .maybeSingle()
    if (!client) return null
    return {
      kind: "client",
      clubId,
      telegramId,
      clientId: client.id,
      fullName: client.full_name,
      preferences,
    }
  }

  return null
}
