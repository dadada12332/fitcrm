"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"

export type ProfileData = {
  fullName: string
  email: string
  phone: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  clubName: string
  role: string
  telegramConnected: boolean
  telegramId: string | null
}

export type ProfileResult = { ok?: boolean; error?: string }

export async function getProfileAction(): Promise<ProfileData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const club = await getCurrentClub()
  let telegramConnected = false
  let telegramId: string | null = null

  if (club) {
    const service = createServiceClient()
    const { data: staff } = await service
      .from("staff")
      .select("id")
      .eq("club_id", club.clubId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (staff) {
      const { data: telegramUser } = await service
        .from("telegram_users")
        .select("telegram_id")
        .eq("club_id", club.clubId)
        .eq("staff_id", staff.id)
        .maybeSingle()
      telegramConnected = Boolean(telegramUser)
      telegramId = telegramUser?.telegram_id == null ? null : String(telegramUser.telegram_id)
    }
  }

  const meta = user.user_metadata ?? {}
  return {
    fullName:     data?.full_name ?? (meta.full_name as string) ?? "",
    email:        user.email ?? "",
    phone:        (meta.phone as string) ?? null,
    avatarPreset: (meta.avatar_preset as string) ?? null,
    avatarUrl:    (meta.avatar_url    as string) ?? null,
    clubName: club?.clubName ?? "Клуб",
    role: club?.role ?? "staff",
    telegramConnected,
    telegramId,
  }
}

export async function updateProfileAction(input: {
  fullName: string
  phone: string
}): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const fullName = input.fullName.trim()
  if (!fullName) return { error: "Имя обязательно" }

  // Save the canonical profile and keep the active staff display name in sync.
  const [usersRes, metaRes] = await Promise.all([
    supabase.from("users").update({ full_name: fullName }).eq("id", user.id),
    supabase.auth.updateUser({ data: { full_name: fullName, phone: input.phone.trim() || null } }),
  ])

  if (usersRes.error) return { error: usersRes.error.message }
  if (metaRes.error) return { error: metaRes.error.message }

  const club = await getCurrentClub()
  if (club) {
    const service = createServiceClient()
    const { data: staff } = await service
      .from("staff")
      .select("id, settings")
      .eq("club_id", club.clubId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
    if (staff) {
      const settings = (staff.settings as Record<string, unknown> | null) ?? {}
      const { error: staffError } = await service
        .from("staff")
        .update({ settings: { ...settings, full_name: fullName, phone: input.phone.trim() || null } })
        .eq("id", staff.id)
        .eq("club_id", club.clubId)
      if (staffError) return { error: staffError.message }
    }
  }

  revalidatePath("/profile")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function updateAvatarPresetAction(presetId: string): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { error } = await supabase.auth.updateUser({
    data: { avatar_preset: presetId, avatar_url: null },
  })
  if (error) return { error: error.message }

  revalidatePath("/profile")
  return { ok: true }
}

export async function updateAvatarUrlAction(url: string): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: url, avatar_preset: null },
  })
  if (error) return { error: error.message }

  revalidatePath("/profile")
  return { ok: true }
}

export async function uploadAvatarAction(formData: FormData): Promise<ProfileResult & { url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const file = formData.get("file") as File | null
  if (!file) return { error: "Файл не выбран" }
  if (file.size > 2 * 1024 * 1024) return { error: "Файл не должен превышать 2 МБ" }
  if (!file.type.startsWith("image/")) return { error: "Допустимы только изображения" }

  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${user.id}/avatar.${ext}`

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (upErr) return { error: upErr.message }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)

  const { error: metaErr } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl, avatar_preset: null },
  })
  if (metaErr) return { error: metaErr.message }

  revalidatePath("/profile")
  return { ok: true, url: publicUrl }
}

export async function updatePasswordAction(input: {
  currentPassword: string
  newPassword: string
}): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: "Не авторизован" }
  if (input.newPassword.length < 8) return { error: "Пароль должен быть минимум 8 символов" }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  })
  if (signInErr) return { error: "Текущий пароль неверный" }

  const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  if (error) return { error: error.message }

  return { ok: true }
}

export async function updateEmailAction(input: {
  newEmail: string
  password: string
}): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: "Не авторизован" }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.password,
  })
  if (signInErr) return { error: "Неверный пароль" }

  const { error } = await supabase.auth.updateUser({ email: input.newEmail })
  if (error) return { error: error.message }

  return { ok: true }
}

export async function signOutOtherSessionsAction(): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }
  const { error } = await supabase.auth.signOut({ scope: "others" })
  return error ? { error: error.message } : { ok: true }
}

export async function disconnectProfileTelegramAction(): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const service = createServiceClient()
  const { data: staff } = await service
    .from("staff")
    .select("id")
    .eq("club_id", club.clubId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()
  if (!staff) return { error: "Профиль сотрудника не найден" }

  const { error } = await service
    .from("telegram_users")
    .delete()
    .eq("club_id", club.clubId)
    .eq("staff_id", staff.id)
  if (error) return { error: error.message }

  revalidatePath("/profile")
  return { ok: true }
}
