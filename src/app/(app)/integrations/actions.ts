"use server"

import { can } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { callTelegramApi, registerClubTelegramBot } from "@/lib/telegram/api"
import { createTelegramPairing } from "@/lib/telegram/pairing"
import type { TelegramSettings } from "./types"
import { consumeMonthlyLimit, requireIntegrationSlot, requirePlanFeature, requirePlanSection } from "@/lib/plan-enforcement"

export type TelegramBotInfo = { username: string; firstName: string; id: number }


export async function connectTelegramAction(
  token: string,
): Promise<{ error?: string; ok?: boolean; bot?: TelegramBotInfo }> {
  const trimmed = token.trim()
  if (!trimmed) return { error: "Введите Bot Token" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }
  const featureError = requirePlanFeature(cc, "telegram")
  if (featureError) return { error: featureError }

  let bot: TelegramBotInfo
  try {
    const json = await callTelegramApi<{ username: string; first_name: string; id: number }>(trimmed, "getMe")
    if (!json.ok) return { error: "Неверный токен. Получите токен у @BotFather в Telegram" }
    if (!json.result?.username) return { error: "Telegram не вернул username бота" }
    bot = { username: json.result.username, firstName: json.result.first_name, id: json.result.id }
  } catch {
    return { error: "Не удалось связаться с Telegram. Проверьте интернет и попробуйте снова" }
  }

  const service = createServiceClient()
  const [{ data: club }, { data: existingIntegration }, { data: tokenOwner }] = await Promise.all([
    service.from("clubs").select("settings").eq("id", cc.clubId).single(),
    service.from("telegram_integrations").select("bot_token").eq("club_id", cc.clubId).maybeSingle(),
    service.from("telegram_integrations").select("club_id").eq("bot_token", trimmed).maybeSingle(),
  ])
  if (tokenOwner && tokenOwner.club_id !== cc.clubId) {
    return { error: "Этот бот уже подключён к другому клубу. Создайте отдельного бота через @BotFather" }
  }
  if (!existingIntegration) {
    const limitError = await requireIntegrationSlot(cc)
    if (limitError) return { error: limitError }
  }
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  try {
    await registerClubTelegramBot(trimmed, cc.clubId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось зарегистрировать webhook Telegram" }
  }

  if (existingIntegration?.bot_token && existingIntegration.bot_token !== trimmed) {
    await callTelegramApi(existingIntegration.bot_token, "deleteWebhook", { drop_pending_updates: false }).catch(() => null)
  }

  const { error: tokenError } = await service.from("telegram_integrations").upsert({
    club_id: cc.clubId,
    bot_token: trimmed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "club_id" })
  if (tokenError) return { error: tokenError.message }

  const { error } = await service.from("clubs").update({
    settings: {
      ...cur,
      tg_bot: {
        ...((cur.tg_bot as Record<string, unknown> | undefined) ?? {}),
        username: bot.username,
        firstName: bot.firstName,
        id: bot.id,
        connected_at: new Date().toISOString(),
        webhook_registered: true,
      },
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

  const service = createServiceClient()
  const [{ data: club }, { data: integration }] = await Promise.all([
    service.from("clubs").select("settings").eq("id", cc.clubId).single(),
    service.from("telegram_integrations").select("bot_token").eq("club_id", cc.clubId).maybeSingle(),
  ])
  const cur = (club?.settings as Record<string, unknown>) ?? {}
  const rest = { ...cur }
  delete rest.tg_bot

  if (integration?.bot_token) {
    await callTelegramApi(integration.bot_token, "deleteWebhook", { drop_pending_updates: false }).catch(() => null)
  }

  const { error: tokenError } = await service.from("telegram_integrations").delete().eq("club_id", cc.clubId)
  if (tokenError) return { error: tokenError.message }
  await service.storage.from("avatars").remove([`${cc.clubId}/telegram-bot-avatar.jpg`])
  const { error } = await service.from("clubs").update({ settings: rest }).eq("id", cc.clubId)
  if (error) return { error: error.message }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true }
}

const TELEGRAM_AVATAR_PATH = "telegram-bot-avatar.jpg"
const TELEGRAM_AVATAR_MAX_BYTES = 5 * 1024 * 1024
const TELEGRAM_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

type TelegramAvatarResult = { error?: string; ok?: boolean; url?: string; warning?: string }

async function getTelegramAvatarContext(): Promise<{
  error?: string
  clubId?: string
  token?: string
  service?: ReturnType<typeof createServiceClient>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }

  const service = createServiceClient()
  const { data: integration } = await service.from("telegram_integrations")
    .select("bot_token").eq("club_id", cc.clubId).maybeSingle()
  if (!integration?.bot_token) return { error: "Сначала подключите Telegram-бота" }

  return { clubId: cc.clubId, token: integration.bot_token, service }
}

async function updateTelegramAvatarSettings(
  service: ReturnType<typeof createServiceClient>,
  clubId: string,
  avatarUrl: string | null,
): Promise<string | null> {
  const { data: club, error: readError } = await service.from("clubs")
    .select("settings").eq("id", clubId).single()
  if (readError) return readError.message

  const settings = (club.settings as Record<string, unknown> | null) ?? {}
  const tgBot = { ...((settings.tg_bot as Record<string, unknown> | undefined) ?? {}) }
  if (avatarUrl) {
    tgBot.avatar_url = avatarUrl
    tgBot.avatar_updated_at = new Date().toISOString()
  } else {
    delete tgBot.avatar_url
    delete tgBot.avatar_updated_at
  }

  const { error } = await service.from("clubs").update({
    settings: { ...settings, tg_bot: tgBot },
  }).eq("id", clubId)
  return error?.message ?? null
}

export async function uploadTelegramBotAvatarAction(formData: FormData): Promise<TelegramAvatarResult> {
  const image = formData.get("avatar")
  if (!(image instanceof File) || image.size === 0) return { error: "Выберите изображение" }
  if (!TELEGRAM_AVATAR_TYPES.has(image.type)) return { error: "Поддерживаются JPG, PNG и WebP" }
  if (image.size > TELEGRAM_AVATAR_MAX_BYTES) return { error: "Файл должен быть не больше 5 МБ" }

  const context = await getTelegramAvatarContext()
  if (!context.clubId || !context.token || !context.service) return { error: context.error }

  let jpeg: Buffer
  try {
    const sharp = (await import("sharp")).default
    jpeg = await sharp(Buffer.from(await image.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer()
  } catch {
    return { error: "Не удалось обработать изображение. Попробуйте другой файл" }
  }
  const jpegBytes = new Uint8Array(jpeg)

  try {
    const body = new FormData()
    body.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }))
    body.append("avatar", new Blob([jpegBytes], { type: "image/jpeg" }), "avatar.jpg")
    const response = await fetch(`https://api.telegram.org/bot${context.token}/setMyProfilePhoto`, {
      method: "POST",
      body,
      cache: "no-store",
    })
    const result = await response.json() as { ok?: boolean; description?: string }
    if (!response.ok || !result.ok) {
      return { error: result.description ?? "Telegram не принял изображение" }
    }
  } catch {
    return { error: "Не удалось связаться с Telegram. Попробуйте снова" }
  }

  const path = `${context.clubId}/${TELEGRAM_AVATAR_PATH}`
  const storageBody = new Blob([jpegBytes], { type: "image/jpeg" })
  const { error: uploadError } = await context.service.storage.from("avatars").upload(path, storageBody, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  })
  if (uploadError) {
    return { ok: true, warning: "Аватар установлен в Telegram, но предпросмотр в CRM не обновился" }
  }

  const { data: storedAvatar, error: downloadError } = await context.service.storage.from("avatars").download(path)
  const signature = storedAvatar
    ? new Uint8Array(await storedAvatar.arrayBuffer()).subarray(0, 3)
    : new Uint8Array()
  if (downloadError || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
    await context.service.storage.from("avatars").remove([path])
    return { ok: true, warning: "Аватар установлен в Telegram, но проверка предпросмотра не прошла" }
  }

  const { data } = context.service.storage.from("avatars").getPublicUrl(path)
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`
  const settingsError = await updateTelegramAvatarSettings(context.service, context.clubId, avatarUrl)
  if (settingsError) {
    return { ok: true, warning: "Аватар установлен в Telegram, но предпросмотр в CRM не сохранился" }
  }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true, url: avatarUrl }
}

export async function removeTelegramBotAvatarAction(): Promise<TelegramAvatarResult> {
  const context = await getTelegramAvatarContext()
  if (!context.clubId || !context.token || !context.service) return { error: context.error }

  try {
    const result = await callTelegramApi(context.token, "removeMyProfilePhoto", {})
    if (!result.ok) return { error: "Telegram не смог удалить аватар" }
  } catch {
    return { error: "Не удалось связаться с Telegram. Попробуйте снова" }
  }

  await context.service.storage.from("avatars").remove([`${context.clubId}/${TELEGRAM_AVATAR_PATH}`])
  const settingsError = await updateTelegramAvatarSettings(context.service, context.clubId, null)
  if (settingsError) {
    return { ok: true, warning: "Аватар удалён в Telegram, но предпросмотр CRM не обновился" }
  }

  revalidatePath("/integrations")
  revalidatePath("/integrations/telegram")
  return { ok: true }
}

// ── Broadcast helpers ────────────────────────────────────────────

type BroadcastCtx = { clubId: string; clubName: string; botUsername: string; token: string; userId: string }

async function getBroadcastCtx(): Promise<{ ctx?: BroadcastCtx; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const cc = await getCurrentClub()
  if (!cc) return { error: "Клуб не найден" }
  if (!can(cc.permissions, "telegram", "manage")) return { error: "Недостаточно прав" }
  const featureError = requirePlanFeature(cc, "broadcasts")
  if (featureError) return { error: featureError }
  const sectionError = requirePlanSection(cc, "broadcasts")
  if (sectionError) return { error: sectionError }

  const [{ data: club }, { data: integration }] = await Promise.all([
    supabase.from("clubs").select("name, settings").eq("id", cc.clubId).single(),
    createServiceClient().from("telegram_integrations").select("bot_token").eq("club_id", cc.clubId).maybeSingle(),
  ])
  const token = integration?.bot_token as string | null
  if (!token) return { error: "Сначала подключите бота на вкладке «Основное»" }
  const settings = (club?.settings as Record<string, unknown> | null) ?? {}
  const bot = (settings.tg_bot as { username?: string } | undefined) ?? {}
  if (!bot.username) return { error: "Переподключите бота: не найден его Telegram username" }

  return { ctx: { clubId: cc.clubId, clubName: club?.name ?? "Клуб", botUsername: bot.username, token, userId: user.id } }
}

export async function createTelegramStaffPairingAction(): Promise<{ error?: string; ok?: boolean; pairingUrl?: string }> {
  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const service = createServiceClient()
  const { data: staff } = await service.from("staff").select("id")
    .eq("club_id", ctx.clubId).eq("user_id", ctx.userId).eq("is_active", true).maybeSingle()
  if (!staff) return { error: "Текущий пользователь не найден среди сотрудников клуба" }

  const pairing = createTelegramPairing()
  await service.from("telegram_staff_pairings").delete()
    .eq("club_id", ctx.clubId).eq("staff_id", staff.id).is("used_at", null)

  const { error: insertError } = await service.from("telegram_staff_pairings").insert({
    club_id: ctx.clubId,
    staff_id: staff.id,
    token_hash: pairing.tokenHash,
    expires_at: pairing.expiresAt,
    created_by: ctx.userId,
  })
  if (insertError) return { error: insertError.message }

  return {
    ok: true,
    pairingUrl: `https://t.me/${encodeURIComponent(ctx.botUsername)}?start=${encodeURIComponent(pairing.payload)}`,
  }
}

/** Загружает картинку рассылки в storage и возвращает public URL. */
async function uploadBroadcastImage(clubId: string, image: File): Promise<string | null> {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
  if (!allowedTypes.has(image.type) || image.size > 8 * 1024 * 1024) return null
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

function validateBroadcastPayload(message: string, image: FormDataEntryValue | null): string | null {
  const hasImage = image instanceof File && image.size > 0
  if (!message && !hasImage) return "Добавьте текст или изображение"
  if (hasImage) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
      return "Поддерживаются JPG, PNG, WebP и GIF"
    }
    if (image.size > 8 * 1024 * 1024) return "Изображение должно быть не больше 8 МБ"
  }
  const messageLimit = hasImage ? 1024 : 4096
  if (message.length > messageLimit) {
    return hasImage
      ? "Подпись к изображению должна быть не длиннее 1024 символов"
      : "Сообщение должно быть не длиннее 4096 символов"
  }
  return null
}

export async function broadcastTelegramAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; sent?: number; failed?: number; total?: number }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  const audience = String(formData.get("audience") ?? "all")
  const audienceLabel = String(formData.get("audience_label") ?? "")
  const payloadError = validateBroadcastPayload(message, image)
  if (payloadError) return { error: payloadError }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const { getRecipientsDataset, filterByAudience, sendBroadcast } = await import("@/lib/broadcast")
  const dataset = await getRecipientsDataset(supabase, ctx.clubId)
  const recipients = filterByAudience(dataset, audience, parseManualIds(formData))
  if (recipients.length === 0) return { error: "Нет получателей в выбранной аудитории", sent: 0, failed: 0, total: 0 }
  const currentClub = await getCurrentClub()
  if (!currentClub) return { error: "Клуб не найден" }
  const usageError = await consumeMonthlyLimit(currentClub, "telegram_messages", recipients.length)
  if (usageError) return { error: usageError }

  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null
  if (hasImage && !imageUrl) return { error: "Не удалось загрузить изображение. Попробуйте ещё раз" }

  const { delivered, failed } = await sendBroadcast(ctx.token, recipients, message, imageUrl, ctx.clubName)

  const { error: historyError } = await supabase.from("broadcasts").insert({
    club_id: ctx.clubId, message: message || null, image_url: imageUrl,
    audience, audience_label: audienceLabel || null,
    status: "sent", sent_at: new Date().toISOString(),
    total: recipients.length, delivered, failed, created_by: ctx.userId,
  })
  if (historyError) return { error: `Сообщения отправлены, но история не сохранена: ${historyError.message}`, sent: delivered, failed, total: recipients.length }

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
  const payloadError = validateBroadcastPayload(message, image)
  if (payloadError) return { error: payloadError }
  if (!scheduledAt) return { error: "Укажите дату и время" }
  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) return { error: "Время должно быть в будущем" }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null
  if (hasImage && !imageUrl) return { error: "Не удалось загрузить изображение. Попробуйте ещё раз" }

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
): Promise<{ error?: string; ok?: boolean; pairingUrl?: string }> {
  const message = String(formData.get("message") ?? "").trim()
  const image = formData.get("image")
  const hasImage = image instanceof File && image.size > 0
  const payloadError = validateBroadcastPayload(message, image)
  if (payloadError) return { error: payloadError }

  const { ctx, error } = await getBroadcastCtx()
  if (!ctx) return { error }

  const supabase = await createClient()
  const { data: staff } = await supabase.from("staff").select("id")
    .eq("club_id", ctx.clubId)
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .maybeSingle()
  if (!staff) return { error: "Текущий пользователь не найден среди сотрудников клуба" }
  const { data: link } = await createServiceClient()
    .from("telegram_users").select("telegram_id")
    .eq("club_id", ctx.clubId).eq("staff_id", staff.id).maybeSingle()
  const selfTg = link?.telegram_id as number | undefined
  if (!selfTg) {
    const pairing = await createTelegramStaffPairingAction()
    return {
      error: pairing.error ?? "Сначала привяжите свой Telegram, затем повторите отправку",
      pairingUrl: pairing.pairingUrl,
    }
  }

  const { data: profile } = await supabase.from("users").select("full_name").eq("id", ctx.userId).maybeSingle()
  const imageUrl = hasImage ? await uploadBroadcastImage(ctx.clubId, image as File) : null
  if (hasImage && !imageUrl) return { error: "Не удалось загрузить изображение. Попробуйте ещё раз" }

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
  const automationError = requirePlanFeature(cc, "telegram_automation")
  if (automationError) return { error: automationError }

  const templates = [settings.welcome_message, settings.expiry_template, settings.payment_template]
  if (templates.some((template) => typeof template !== "string" || !template.trim())) {
    return { error: "Шаблоны сообщений не могут быть пустыми" }
  }
  if (templates.some((template) => template.length > 4096)) {
    return { error: "Шаблон Telegram не может быть длиннее 4096 символов" }
  }
  const allowedVariables: Array<[string, Set<string>]> = [
    [settings.welcome_message, new Set(["name", "club", "expires"])],
    [settings.expiry_template, new Set(["name", "club", "days", "expires"])],
    [settings.payment_template, new Set(["amount", "membership", "expires"])],
  ]
  for (const [template, allowed] of allowedVariables) {
    const unknown = [...template.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1].trim().toLowerCase()).find((key) => !allowed.has(key))
    if (unknown) return { error: `Неизвестная переменная в шаблоне: {{${unknown}}}` }
  }

  const { data: club } = await supabase.from("clubs").select("settings").eq("id", cc.clubId).single()
  const cur = (club?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase.from("clubs").update({
    settings: { ...cur, tg_settings: settings },
  }).eq("id", cc.clubId)

  if (error) return { error: error.message }

  revalidatePath("/integrations/telegram")
  return { ok: true }
}
