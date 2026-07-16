"use server"

import { can } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
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

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", cc.clubId).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    tg_token: trimmed,
    settings: {
      ...cur,
      tg_bot: { username: bot.username, firstName: bot.firstName, id: bot.id, connected_at: new Date().toISOString() },
    },
  }).eq("id", cc.clubId)

  if (error) return { error: error.message }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true, bot }
}

export async function disconnectTelegramAction(): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", cc.clubId).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}
  const { tg_bot: _removed, tg_settings: _settings, ...rest } = cur as any

  const { error } = await supabase.from("clubs").update({ tg_token: null, settings: rest }).eq("id", cc.clubId)
  if (error) return { error: error.message }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true }
}

// ── Broadcast helpers ────────────────────────────────────────────

type BroadcastCtx = { clubId: string; clubName: string; token: string; userId: string }

async function getBroadcastCtx(): Promise<{ ctx?: BroadcastCtx; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }

  const { data: club } = await supabase.from("clubs").select("name, tg_token").eq("id", cc.clubId).single()
  const token = club?.tg_token as string | null
  if (!token) return { error: "Сначала подключите бота на вкладке «Основное»" }

  return { ctx: { clubId: cc.clubId, clubName: club?.name ?? "Клуб", token, userId: user.id } }
}

/** Загружает картинку рассылки в storage и возвращает public URL. */
async function uploadBroadcastImage(clubId: string, image: File): Promise<string | null> {
  const supabase = await createClient()
  const ext = (image.name.split(".").pop() || "jpg").toLowerCase()
  const path = `${clubId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from("broadcasts").upload(path, image, { contentType: image.type, upsert: false })
  if (error) return null
  return supabase.storage.from("broadcasts").getPublicUrl(path).data.publicUrl
}

function parseManualIds(formData: FormData): number[] {
  return String(formData.get("manual_ids") ?? "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
}

export async function broadcastTelegramAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; sent?: number; failed?: number; total?: number }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  const audience = String(formData.get("audience") ?? "all")
  const audienceLabel = String(formData.get("audience_label") ?? "")
  if (!message && !hasImage) return { error: "Добавьте текст или изображение" }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const { getRecipientsDataset, filterByAudience, sendBroadcast } = await import("@/lib/broadcast")
  const dataset = await getRecipientsDataset(supabase, ctx.clubId)
  const recipients = filterByAudience(dataset, audience, parseManualIds(formData))
  if (recipients.length === 0) return { error: "Нет получателей в выбранной аудитории", sent: 0, failed: 0, total: 0 }

  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null

  const { delivered, failed } = await sendBroadcast(ctx.token, recipients, message, imageUrl, ctx.clubName)

  await supabase.from("broadcasts").insert({
    club_id: ctx.clubId, message: message || null, image_url: imageUrl,
    audience, audience_label: audienceLabel || null,
    status: "sent", sent_at: new Date().toISOString(),
    total: recipients.length, delivered, failed, created_by: ctx.userId,
  })

  revalidatePath("/integrations/telegram")
  return { ok: true, sent: delivered, failed, total: recipients.length }
}

export async function scheduleBroadcastAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  const audience = String(formData.get("audience") ?? "all")
  const audienceLabel = String(formData.get("audience_label") ?? "")
  const scheduledAt = String(formData.get("scheduled_at") ?? "")
  if (!message && !hasImage) return { error: "Добавьте текст или изображение" }
  if (!scheduledAt) return { error: "Укажите дату и время" }
  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) return { error: "Время должно быть в будущем" }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null

  const { error: insErr } = await supabase.from("broadcasts").insert({
    club_id: ctx.clubId, message: message || null, image_url: imageUrl,
    audience, audience_label: audienceLabel || null,
    recipient_ids: audience === "manual" ? parseManualIds(formData) : null,
    status: "scheduled", scheduled_at: when.toISOString(),
    created_by: ctx.userId,
  })
  if (insErr) return { error: insErr.message }

  revalidatePath("/integrations/telegram")
  return { ok: true }
}

export async function testBroadcastAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  if (!message && !hasImage) return { error: "Добавьте текст или изображение" }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const { data: staff } = await supabase.from("staff").select("id").eq("user_id", ctx.userId).single()
  const { data: link } = await supabase
    .from("telegram_users").select("telegram_id").eq("staff_id", staff?.id ?? "").maybeSingle()
  const selfTg = link?.telegram_id as number | undefined
  if (!selfTg) return { error: "Привяжите свой телефон в боте (/start), чтобы отправлять тест себе" }

  const { data: profile } = await supabase.from("users").select("full_name").eq("id", ctx.userId).maybeSingle()
  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null

  const { sendBroadcast } = await import("@/lib/broadcast")
  const self = {
    telegramId: selfTg, fullName: profile?.full_name ?? "Тест",
    membership: "PRO", membershipId: null, expiresAt: null, visitsLeft: null, status: "active", daysLeft: 30,
  }
  const { delivered } = await sendBroadcast(ctx.token, [self], message, imageUrl, ctx.clubName)
  if (!delivered) return { error: "Не удалось отправить. Откройте чат с ботом и попробуйте снова" }
  return { ok: true }
}

export async function saveTelegramSettingsAction(
  settings: TelegramSettings,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", cc.clubId).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, tg_settings: settings },
  }).eq("id", cc.clubId)

  if (error) return { error: error.message }

  revalidatePath("/integrations/telegram")
  return { ok: true }
}
