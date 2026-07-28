"use server"

import { revalidatePath } from "next/cache"
import {
  findPlatformUserByEmail,
  platformBase,
  requirePlatformPermission,
  type PlatformRole,
} from "@/lib/platform"
import { createServiceClient } from "@/lib/supabase/service"

type Result = { ok?: boolean; error?: string }

function roleError(message: string): string {
  if (message.includes("platform_super_admin_required")) return "Требуются права суперадминистратора"
  if (message.includes("platform_self_role_change_forbidden")) return "Свою роль нельзя изменить из этого раздела"
  if (message.includes("platform_last_super_admin")) return "Нельзя удалить последнего суперадминистратора"
  if (message.includes("platform_target_user_not_found")) return "Пользователь не найден"
  return "Не удалось изменить роль администратора"
}

async function setRole(targetUserId: string, role: PlatformRole | null): Promise<Result> {
  const auth = await requirePlatformPermission("admins.manage")
  const service = createServiceClient()
  const { error } = await service.rpc("platform_set_admin_role", {
    p_actor_id: auth.userId,
    p_target_id: targetUserId,
    p_role: role,
  })
  if (error) return { error: roleError(error.message) }
  const base = await platformBase()
  revalidatePath(`${base}/settings`)
  revalidatePath(`${base}/users`)
  return { ok: true }
}

export async function addPlatformAdminAction(formData: FormData): Promise<Result> {
  await requirePlatformPermission("admins.manage")
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const role = String(formData.get("role") ?? "") as PlatformRole
  if (!email || !email.includes("@")) return { error: "Введите корректный email" }
  if (role !== "platform_admin" && role !== "super_admin") return { error: "Выберите роль" }

  const user = await findPlatformUserByEmail(email)
  if (!user) return { error: "Сначала пользователь должен зарегистрироваться в Zalkins" }
  if (user.platformRole === role) return { error: "У пользователя уже назначена эта роль" }
  return setRole(user.id, role)
}

export async function changePlatformAdminRoleAction(targetUserId: string, role: PlatformRole): Promise<Result> {
  if (role !== "platform_admin" && role !== "super_admin") return { error: "Некорректная роль" }
  return setRole(targetUserId, role)
}

export async function removePlatformAdminAction(targetUserId: string): Promise<Result> {
  return setRole(targetUserId, null)
}

export async function savePlatformOperationalSettingsAction(input: {
  registrationEnabled: boolean
  maintenanceMessage: string
}): Promise<Result> {
  const auth = await requirePlatformPermission("settings.manage")
  const maintenanceMessage = input.maintenanceMessage.trim()
  if (maintenanceMessage.length > 240) return { error: "Сообщение не должно превышать 240 символов" }
  const service = createServiceClient()
  const { error } = await service.from("platform_operational_settings").upsert({
    id: 1,
    registration_enabled: input.registrationEnabled,
    maintenance_message: maintenanceMessage || null,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: "Не удалось сохранить операционные настройки" }
  const base = await platformBase()
  revalidatePath(`${base}/settings`)
  revalidatePath("/", "layout")
  return { ok: true }
}
