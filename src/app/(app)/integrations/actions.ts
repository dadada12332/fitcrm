"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { TelegramSettings } from "./types"

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

export async function broadcastTelegramAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; sent?: number; failed?: number; total?: number }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  if (!message && !hasImage) return { error: "Добавьте текст или изображение" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  const { data: club } = await supabase.from("clubs").select("tg_token").eq("id", staff.club_id).single()
  const token = club?.tg_token as string | null
  if (!token) return { error: "Сначала подключите бота на вкладке «Основное»" }

  const { data: recipients } = await supabase
    .from("clients")
    .select("telegram_id")
    .eq("club_id", staff.club_id)
    .not("telegram_id", "is", null)

  const ids = (recipients ?? []).map((r) => r.telegram_id as number).filter(Boolean)
  if (ids.length === 0) return { error: "Нет подписчиков бота", sent: 0, failed: 0, total: 0 }

  let sent = 0
  let failed = 0

  for (const chatId of ids) {
    try {
      let res: Response
      if (hasImage) {
        const fd = new FormData()
        fd.append("chat_id", String(chatId))
        fd.append("photo", image as File)
        if (message) fd.append("caption", message)
        res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: fd })
      } else {
        res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        })
      }
      const json = await res.json()
      if (json.ok) sent++
      else failed++
    } catch {
      failed++
    }
  }

  return { ok: true, sent, failed, total: ids.length }
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
