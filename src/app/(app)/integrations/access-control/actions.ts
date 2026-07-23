"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { can } from "@/lib/permissions"
import { createServiceClient } from "@/lib/supabase/service"
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/crypto"
import {
  ACCESS_CONTROL_MODES,
  type AccessControlCredentialType,
  type AccessControlProvider,
} from "@/lib/access-control/types"
import {
  hashWebhookKey,
  isAccessControlProvider,
  normalizeCredentialUid,
  processNormalizedAccessEvent,
  type AuthenticatedIntegration,
} from "@/lib/access-control/service"

type ActionContext = Awaited<ReturnType<typeof getContext>>

async function getContext() {
  const [user, club] = await Promise.all([getAuthUser(), getCurrentClub()])
  if (!user) return { ok: false as const, error: "Не авторизован" }
  if (!club) return { ok: false as const, error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "integrations")) {
    return { ok: false as const, error: "Недостаточно прав" }
  }
  return { ok: true as const, user, club }
}

function parseProvider(provider: string): AccessControlProvider | null {
  return isAccessControlProvider(provider) ? provider : null
}

function validateBaseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length > 500) throw new Error("Адрес слишком длинный")
  const url = new URL(trimmed)
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Поддерживаются только HTTP и HTTPS")
  url.username = ""
  url.password = ""
  return url.toString().replace(/\/$/, "")
}

function readEncryptedSecret(blob: string | null | undefined) {
  if (!blob) return {} as { connectionSecret?: string; webhookKey?: string }
  return JSON.parse(decryptIntegrationSecret(blob)) as { connectionSecret?: string; webhookKey?: string }
}

function revalidateProvider(provider: AccessControlProvider) {
  revalidatePath("/integrations")
  revalidatePath(`/integrations/${provider}`)
  revalidatePath("/visits")
}

export async function saveAccessControlIntegrationAction(input: {
  provider: string
  displayName: string
  mode: string
  baseUrl: string
  username: string
  secret: string
}): Promise<{ ok?: true; webhookKey?: string; error?: string }> {
  if (!input || typeof input !== "object"
    || typeof input.provider !== "string"
    || typeof input.displayName !== "string"
    || typeof input.mode !== "string"
    || typeof input.baseUrl !== "string"
    || typeof input.username !== "string"
    || typeof input.secret !== "string") {
    return { error: "Некорректные данные подключения" }
  }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  const provider = parseProvider(input.provider)
  if (!provider) return { error: "Неизвестный провайдер" }
  if (!ACCESS_CONTROL_MODES[provider].includes(input.mode)) return { error: "Неподдерживаемый режим подключения" }

  const displayName = input.displayName.trim()
  if (!displayName || displayName.length > 80) return { error: "Введите название подключения до 80 символов" }
  if (input.username.length > 160 || input.secret.length > 1000) return { error: "Слишком длинные учётные данные" }

  let baseUrl = ""
  try {
    baseUrl = validateBaseUrl(input.baseUrl)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Некорректный адрес сервера" }
  }

  const service = createServiceClient()
  const { data: existing } = await service
    .from("access_control_integrations")
    .select("id,secret_enc")
    .eq("club_id", ctx.club.clubId)
    .eq("provider", provider)
    .maybeSingle()

  let previous: { connectionSecret?: string; webhookKey?: string }
  try {
    previous = readEncryptedSecret(existing?.secret_enc)
  } catch {
    return { error: "Не удалось расшифровать сохранённые данные. Обратитесь в поддержку" }
  }
  const isNew = !existing
  const webhookKey = previous.webhookKey || crypto.randomBytes(32).toString("base64url")
  const connectionSecret = input.secret || previous.connectionSecret || ""
  const secretEnc = encryptIntegrationSecret(JSON.stringify({ connectionSecret, webhookKey }))
  const now = new Date().toISOString()

  const row = {
    club_id: ctx.club.clubId,
    provider,
    display_name: displayName,
    mode: input.mode,
    status: "configured",
    base_url: baseUrl || null,
    username: input.username.trim() || null,
    secret_enc: secretEnc,
    webhook_key_hash: hashWebhookKey(webhookKey),
    config: {
      timezone: "Asia/Tashkent",
      hardware_verified: false,
      read_only: true,
    },
    last_error: null,
    connected_by: ctx.user.id,
    updated_at: now,
  }

  if (existing) {
    const { error } = await service.from("access_control_integrations")
      .update(row)
      .eq("id", existing.id)
      .eq("club_id", ctx.club.clubId)
    if (error) return { error: "Не удалось сохранить подключение" }
  } else {
    const { error } = await service.from("access_control_integrations").insert(row)
    if (error?.code === "23505") {
      // Another first-save request won the race. Preserve its webhook key
      // instead of overwriting it with a key that another response exposed.
      const { data: concurrent } = await service
        .from("access_control_integrations")
        .select("id,secret_enc")
        .eq("club_id", ctx.club.clubId)
        .eq("provider", provider)
        .maybeSingle()
      if (!concurrent) return { error: "Не удалось сохранить подключение" }
      let concurrentSecret: { connectionSecret?: string; webhookKey?: string }
      try {
        concurrentSecret = readEncryptedSecret(concurrent.secret_enc)
      } catch {
        return { error: "Не удалось расшифровать сохранённые данные. Обратитесь в поддержку" }
      }
      const concurrentWebhookKey = concurrentSecret.webhookKey
      if (!concurrentWebhookKey) return { error: "Не удалось получить ключ подключения" }
      const { error: updateError } = await service.from("access_control_integrations")
        .update({
          ...row,
          secret_enc: encryptIntegrationSecret(JSON.stringify({
            connectionSecret: input.secret || concurrentSecret.connectionSecret || "",
            webhookKey: concurrentWebhookKey,
          })),
          webhook_key_hash: hashWebhookKey(concurrentWebhookKey),
        })
        .eq("id", concurrent.id)
        .eq("club_id", ctx.club.clubId)
      if (updateError) return { error: "Не удалось сохранить подключение" }
      revalidateProvider(provider)
      return { ok: true }
    }
    if (error) return { error: "Не удалось сохранить подключение" }
  }

  revalidateProvider(provider)
  return { ok: true, webhookKey: isNew ? webhookKey : undefined }
}

export async function rotateAccessControlWebhookKeyAction(providerValue: string): Promise<{
  ok?: true
  webhookKey?: string
  error?: string
}> {
  if (typeof providerValue !== "string") return { error: "Некорректный провайдер" }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  const provider = parseProvider(providerValue)
  if (!provider) return { error: "Неизвестный провайдер" }

  const service = createServiceClient()
  const { data } = await service.from("access_control_integrations")
    .select("id,secret_enc")
    .eq("club_id", ctx.club.clubId)
    .eq("provider", provider)
    .maybeSingle()
  if (!data) return { error: "Сначала сохраните подключение" }

  let previous: { connectionSecret?: string; webhookKey?: string }
  try {
    previous = readEncryptedSecret(data.secret_enc)
  } catch {
    return { error: "Не удалось расшифровать сохранённые данные. Обратитесь в поддержку" }
  }
  const webhookKey = crypto.randomBytes(32).toString("base64url")
  const { error } = await service.from("access_control_integrations").update({
    secret_enc: encryptIntegrationSecret(JSON.stringify({
      connectionSecret: previous.connectionSecret || "",
      webhookKey,
    })),
    webhook_key_hash: hashWebhookKey(webhookKey),
    status: "configured",
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", data.id).eq("club_id", ctx.club.clubId)
  if (error) return { error: "Не удалось обновить ключ" }

  revalidateProvider(provider)
  return { ok: true, webhookKey }
}

export async function disconnectAccessControlIntegrationAction(providerValue: string): Promise<{
  ok?: true
  error?: string
}> {
  if (typeof providerValue !== "string") return { error: "Некорректный провайдер" }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  const provider = parseProvider(providerValue)
  if (!provider) return { error: "Неизвестный провайдер" }
  const { error } = await createServiceClient().from("access_control_integrations").update({
    status: "disabled",
    updated_at: new Date().toISOString(),
  }).eq("club_id", ctx.club.clubId).eq("provider", provider)
  if (error) return { error: "Не удалось отключить интеграцию" }
  revalidateProvider(provider)
  return { ok: true }
}

const CREDENTIAL_TYPES = new Set<AccessControlCredentialType>(["card", "bracelet", "qr", "face", "external_id"])

export async function addAccessCredentialAction(input: {
  provider: string
  clientId: string
  credentialType: string
  credentialUid: string
}): Promise<{ ok?: true; error?: string }> {
  if (!input || typeof input !== "object"
    || typeof input.provider !== "string"
    || typeof input.clientId !== "string"
    || typeof input.credentialType !== "string"
    || typeof input.credentialUid !== "string") {
    return { error: "Некорректные данные идентификатора" }
  }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!can(ctx.club.permissions, "clients", "edit")) return { error: "Нет права изменять данные клиентов" }
  const provider = parseProvider(input.provider)
  if (!provider) return { error: "Неизвестный провайдер" }
  if (!CREDENTIAL_TYPES.has(input.credentialType as AccessControlCredentialType)) {
    return { error: "Неизвестный тип идентификатора" }
  }

  let uid = ""
  try {
    uid = normalizeCredentialUid(input.credentialUid)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Некорректный идентификатор" }
  }

  const service = createServiceClient()
  const [{ data: integration }, { data: client }] = await Promise.all([
    service.from("access_control_integrations").select("id")
      .eq("club_id", ctx.club.clubId).eq("provider", provider).maybeSingle(),
    service.from("clients").select("id")
      .eq("club_id", ctx.club.clubId).eq("id", input.clientId).maybeSingle(),
  ])
  if (!integration) return { error: "Сначала сохраните подключение" }
  if (!client) return { error: "Клиент не найден в этом клубе" }

  const { error } = await service.from("access_control_credentials").insert({
    club_id: ctx.club.clubId,
    integration_id: integration.id,
    client_id: client.id,
    credential_type: input.credentialType,
    credential_uid: uid,
    active: true,
  })
  if (error) return { error: error.code === "23505" ? "Этот идентификатор уже привязан" : "Не удалось привязать идентификатор" }
  revalidateProvider(provider)
  return { ok: true }
}

export async function removeAccessCredentialAction(credentialId: string): Promise<{
  ok?: true
  error?: string
}> {
  if (typeof credentialId !== "string" || !credentialId) return { error: "Некорректная привязка" }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!can(ctx.club.permissions, "clients", "edit")) return { error: "Нет права изменять данные клиентов" }
  const service = createServiceClient()
  const { data } = await service.from("access_control_credentials")
    .select("id,integration_id,access_control_integrations(provider)")
    .eq("id", credentialId)
    .eq("club_id", ctx.club.clubId)
    .maybeSingle()
  if (!data) return { error: "Привязка не найдена" }
  const { error } = await service.from("access_control_credentials").delete()
    .eq("id", credentialId).eq("club_id", ctx.club.clubId)
  if (error) return { error: "Не удалось удалить привязку" }

  const relation = data.access_control_integrations as { provider?: string } | Array<{ provider?: string }> | null
  const providerValue = Array.isArray(relation) ? relation[0]?.provider : relation?.provider
  if (providerValue && isAccessControlProvider(providerValue)) revalidateProvider(providerValue)
  return { ok: true }
}

export async function simulateAccessEventAction(input: {
  provider: string
  credentialUid: string
  direction: "entry" | "exit"
}): Promise<{ ok?: true; result?: { allowed: boolean; reason: string; visitId?: string }; error?: string }> {
  if (!input || typeof input !== "object"
    || typeof input.provider !== "string"
    || typeof input.credentialUid !== "string"
    || !["entry", "exit"].includes(input.direction)) {
    return { error: "Некорректные данные симуляции" }
  }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!can(ctx.club.permissions, "visits", "checkin")) return { error: "Нет права создавать посещения" }
  if (!can(ctx.club.permissions, "clients", "view")) return { error: "Нет права просматривать клиентов" }
  const provider = parseProvider(input.provider)
  if (!provider) return { error: "Неизвестный провайдер" }

  const service = createServiceClient()
  const { data } = await service.from("access_control_integrations").select("*")
    .eq("club_id", ctx.club.clubId).eq("provider", provider).neq("status", "disabled").maybeSingle()
  if (!data) return { error: "Подключение не настроено или отключено" }

  const decision = await processNormalizedAccessEvent(data as AuthenticatedIntegration, {
    externalEventId: `sim:${crypto.randomUUID()}`,
    eventType: "passage",
    direction: input.direction,
    result: "allowed",
    credentialUid: input.credentialUid,
    occurredAt: new Date().toISOString(),
    deviceId: "fitcrm-simulator",
    doorId: "demo-entrance",
    simulated: true,
    payload: { source: "fitcrm-simulator" },
  })
  revalidateProvider(provider)
  return {
    ok: true,
    result: {
      allowed: decision.allowed,
      reason: decision.reasonMessage,
      visitId: decision.visitId,
    },
  }
}

export async function validateAccessControlSetupAction(providerValue: string): Promise<{
  ok?: true
  error?: string
}> {
  if (typeof providerValue !== "string") return { error: "Некорректный провайдер" }
  const ctx = await getContext()
  if (!ctx.ok) return { error: ctx.error }
  const provider = parseProvider(providerValue)
  if (!provider) return { error: "Неизвестный провайдер" }
  const { data } = await createServiceClient().from("access_control_integrations")
    .select("mode,base_url,secret_enc,status")
    .eq("club_id", ctx.club.clubId).eq("provider", provider).maybeSingle()
  if (!data) return { error: "Сначала сохраните подключение" }
  if (data.status === "disabled") return { error: "Интеграция отключена" }

  let secret: { connectionSecret?: string; webhookKey?: string }
  try {
    secret = readEncryptedSecret(data.secret_enc)
  } catch {
    return { error: "Не удалось расшифровать сохранённые данные. Обратитесь в поддержку" }
  }
  if (!secret.webhookKey) return { error: "Не создан ключ входящих событий" }
  if (["rest_poll", "zkbio", "isapi", "hikcentral"].includes(data.mode) && !data.base_url) {
    return { error: "Для выбранного режима нужен адрес локального сервера" }
  }
  return { ok: true }
}

export type AccessControlActionContext = ActionContext
