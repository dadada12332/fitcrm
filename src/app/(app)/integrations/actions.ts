"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type TelegramBotInfo = { username: string; firstName: string; id: number }

export async function connectTelegramAction(
  token: string,
): Promise<{ error?: string; ok?: boolean; bot?: TelegramBotInfo }> {
  const trimmed = token.trim()
  if (!trimmed) return { error: "Введите Bot Token" }

  let bot: TelegramBotInfo
  try {
    const res = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`, { cache: "no-store" })
    const json = await res.json()
    if (!json.ok) return { error: "Неверный токен. Получите токен у @BotFather в Telegram" }
    bot = { username: json.result.username, firstName: json.result.first_name, id: json.result.id }
  } catch {
    return { error: "Не удалось связаться с Telegram. Проверьте интернет и попробуйте снова" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    tg_token: trimmed,
    settings: {
      ...cur,
      tg_bot: { username: bot.username, firstName: bot.firstName, id: bot.id, connected_at: new Date().toISOString() },
    },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true, bot }
}

export async function disconnectTelegramAction(): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}
  const { tg_bot: _removed, tg_settings: _settings, ...rest } = cur as any

  const { error } = await supabase.from("clubs").update({ tg_token: null, settings: rest }).eq("id", staff.club_id)
  if (error) return { error: error.message }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true }
}

export type TelegramSettings = {
  auto_expiry_3d: boolean
  auto_expiry_1d: boolean
  qr_checkin: boolean
  renewal_reminder: boolean
  welcome_enabled: boolean
  welcome_message: string
  expiry_template: string
  payment_template: string
}

export const DEFAULT_TG_SETTINGS: TelegramSettings = {
  auto_expiry_3d: true,
  auto_expiry_1d: true,
  qr_checkin: true,
  renewal_reminder: true,
  welcome_enabled: true,
  welcome_message: "Привет, {{name}}! 👋\n\nДобро пожаловать в {{club}}.\nВаш абонемент активен до {{expires}}.",
  expiry_template: "{{name}}, ваш абонемент истекает через {{days}} дн.\n\nПродлить: /renew",
  payment_template: "✅ Оплата подтверждена!\n\nСумма: {{amount}} сум\nАбонемент: {{membership}}\nДействует до: {{expires}}",
}

export async function saveTelegramSettingsAction(
  settings: TelegramSettings,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", staff.club_id).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, tg_settings: settings },
  }).eq("id", staff.club_id)

  if (error) return { error: error.message }

  revalidatePath("/integrations/telegram")
  return { ok: true }
}
