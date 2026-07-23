import "server-only"

import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { decryptIntegrationSecret } from "@/lib/crypto"
import {
  type AccessControlDirection,
  type AccessControlIntegrationDTO,
  type AccessControlProvider,
  type AccessDecision,
  type NormalizedAccessEvent,
} from "@/lib/access-control/types"
import {
  accessEventFingerprint,
  hashWebhookKey,
  normalizeCredentialUid,
  vendorResultAllowsProcessing,
} from "@/lib/access-control/utils"

export { hashWebhookKey, isAccessControlProvider, normalizeCredentialUid } from "@/lib/access-control/utils"

type IntegrationRow = {
  id: string
  club_id: string
  provider: AccessControlProvider
  display_name: string
  mode: string
  status: AccessControlIntegrationDTO["status"]
  base_url: string | null
  username: string | null
  secret_enc: string
  webhook_key_hash: string
  last_seen_at: string | null
  last_event_at: string | null
  last_error: string | null
}

type SecretPayload = {
  connectionSecret?: string
  webhookKey?: string
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"))
}

function readSecret(blob: string): SecretPayload {
  try {
    return JSON.parse(decryptIntegrationSecret(blob)) as SecretPayload
  } catch {
    return {}
  }
}

export async function authenticateAccessControlIntegration(integrationId: string, key: string) {
  const service = createServiceClient()
  const { data } = await service
    .from("access_control_integrations")
    .select("*")
    .eq("id", integrationId)
    .neq("status", "disabled")
    .maybeSingle()

  if (!data || !key || !safeEqualHex(hashWebhookKey(key), data.webhook_key_hash as string)) {
    return null
  }
  return data as IntegrationRow
}

export async function getAccessControlIntegrationDTO(
  clubId: string,
  provider: AccessControlProvider,
): Promise<AccessControlIntegrationDTO | null> {
  const service = createServiceClient()
  const { data } = await service
    .from("access_control_integrations")
    .select("*")
    .eq("club_id", clubId)
    .eq("provider", provider)
    .maybeSingle()

  if (!data) return null
  const row = data as IntegrationRow
  const credentials: Array<Record<string, unknown>> = []
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await service
      .from("access_control_credentials")
      .select("id,client_id,credential_type,credential_uid,active,clients(full_name)")
      .eq("club_id", clubId)
      .eq("integration_id", row.id)
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error || !page) break
    credentials.push(...(page as Array<Record<string, unknown>>))
    if (page.length < 1000) break
  }
  const { data: events } = await service
      .from("access_control_events")
      .select("id,external_event_id,credential_uid,event_type,direction,decision,reason_message,occurred_at,clients(full_name)")
      .eq("club_id", clubId)
      .eq("integration_id", row.id)
      .order("occurred_at", { ascending: false })
      .limit(20)

  const secret = readSecret(row.secret_enc)
  return {
    id: row.id,
    provider,
    displayName: row.display_name,
    mode: row.mode,
    status: row.status,
    baseUrl: row.base_url ?? "",
    username: row.username ?? "",
    hasSecret: Boolean(secret.connectionSecret),
    webhookKeyMask: secret.webhookKey ? `••••${secret.webhookKey.slice(-4)}` : "",
    eventUrl: `${appUrl()}/api/access-control/${row.id}/events`,
    decisionUrl: `${appUrl()}/api/access-control/${row.id}/decision`,
    lastSeenAt: row.last_seen_at,
    lastEventAt: row.last_event_at,
    lastError: row.last_error,
    credentials: (credentials ?? []).map((item) => {
      const clients = item.clients as { full_name?: string } | Array<{ full_name?: string }> | null
      const client = Array.isArray(clients) ? clients[0] : clients
      return {
        id: item.id as string,
        clientId: item.client_id as string,
        clientName: client?.full_name ?? "Клиент удалён",
        credentialType: item.credential_type as AccessControlIntegrationDTO["credentials"][number]["credentialType"],
        credentialUid: maskCredentialUid(item.credential_uid as string) ?? "••••",
        active: item.active as boolean,
      }
    }),
    events: (events ?? []).map((item) => {
      const clients = item.clients as { full_name?: string } | Array<{ full_name?: string }> | null
      const client = Array.isArray(clients) ? clients[0] : clients
      return {
        id: item.id as string,
        externalEventId: item.external_event_id as string,
        clientName: client?.full_name ?? null,
        credentialUid: maskCredentialUid(item.credential_uid as string | null),
        eventType: item.event_type as string,
        direction: item.direction as AccessControlDirection,
        decision: item.decision as AccessControlIntegrationDTO["events"][number]["decision"],
        reasonMessage: item.reason_message as string | null,
        occurredAt: item.occurred_at as string,
      }
    }),
  }
}

async function evaluateCredential(
  integration: IntegrationRow,
  credentialUid: string,
  requireActiveSubscription = true,
): Promise<AccessDecision> {
  const service = createServiceClient()
  const uid = normalizeCredentialUid(credentialUid)
  const { data: mapping } = await service
    .from("access_control_credentials")
    .select("client_id,clients(full_name)")
    .eq("club_id", integration.club_id)
    .eq("integration_id", integration.id)
    .eq("credential_uid", uid)
    .eq("active", true)
    .maybeSingle()

  if (!mapping) {
    return { allowed: false, reasonCode: "credential_not_mapped", reasonMessage: "Карта или браслет не привязаны" }
  }

  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  const { data: subscription } = await service
    .from("subscriptions")
    .select("id,visits_total,visits_used")
    .eq("club_id", integration.club_id)
    .eq("client_id", mapping.client_id)
    .eq("status", "active")
    .lte("starts_at", localDate)
    .or(`expires_at.is.null,expires_at.gte.${localDate}`)
    .order("expires_at", { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  const clients = mapping.clients as { full_name?: string } | Array<{ full_name?: string }> | null
  const client = Array.isArray(clients) ? clients[0] : clients
  if (!requireActiveSubscription) {
    return {
      allowed: true,
      reasonCode: "credential_mapped",
      reasonMessage: "Идентификатор привязан к клиенту",
      clientId: mapping.client_id,
      clientName: client?.full_name,
    }
  }
  if (!subscription) {
    return {
      allowed: false,
      reasonCode: "no_active_subscription",
      reasonMessage: "Нет активного абонемента",
      clientId: mapping.client_id,
      clientName: client?.full_name,
    }
  }
  if (subscription.visits_total !== null && subscription.visits_used >= subscription.visits_total) {
    return {
      allowed: false,
      reasonCode: "visit_limit_exhausted",
      reasonMessage: "Лимит посещений исчерпан",
      clientId: mapping.client_id,
      clientName: client?.full_name,
      subscriptionId: subscription.id,
    }
  }
  return {
    allowed: true,
    reasonCode: "active_subscription",
    reasonMessage: "Проход разрешён",
    clientId: mapping.client_id,
    clientName: client?.full_name,
    subscriptionId: subscription.id,
  }
}

function deterministicEventId(integrationId: string, event: NormalizedAccessEvent) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify([
    integrationId,
    event.eventType,
    event.deviceId ?? "",
    event.doorId ?? "",
    event.credentialUid ?? "",
    event.occurredAt,
    event.direction,
    event.result,
  ])).digest("hex")}`
}

function decisionMessage(reasonCode: string, fallback: string) {
  const messages: Record<string, string> = {
    active_subscription: "Проход разрешён",
    no_active_subscription: "Нет активного абонемента",
    visit_limit_exhausted: "Лимит посещений исчерпан",
    client_not_found: "Клиент не найден в клубе",
    event_not_found: "Событие не найдено",
    processing_error: "Не удалось создать посещение",
    stale_access_request: "Запрос допуска устарел",
    stale_passage: "Событие вне допустимого временного окна",
    anti_passback: "Повторный проход в течение 30 секунд",
    invalid_tenant_reference: "Некорректная связь с клубом",
    idempotency_conflict: "ID события уже использован для другого прохода",
    expired_access_decision: "Решение о допуске устарело",
  }
  return messages[reasonCode] ?? fallback
}

function maskCredentialUid(value: string | null | undefined) {
  if (!value) return null
  const tail = value.slice(-4)
  return `${"•".repeat(Math.min(8, Math.max(4, value.length - tail.length)))}${tail}`
}

export async function processNormalizedAccessEvent(
  integration: IntegrationRow,
  event: NormalizedAccessEvent,
): Promise<AccessDecision> {
  const service = createServiceClient()
  const occurredAt = new Date(event.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    return { allowed: false, reasonCode: "invalid_timestamp", reasonMessage: "Некорректное время события" }
  }

  if (event.eventType === "heartbeat") {
    await service.from("access_control_integrations").update({
      status: "connected",
      last_seen_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id).eq("club_id", integration.club_id)
    return { allowed: true, reasonCode: "heartbeat", reasonMessage: "Соединение активно" }
  }

  if (!event.credentialUid) {
    return { allowed: false, reasonCode: "credential_missing", reasonMessage: "Не передан идентификатор карты" }
  }

  const uid = normalizeCredentialUid(event.credentialUid)
  const requiresActiveSubscription = event.eventType === "access_request"
    || (event.direction === "entry" && event.eventType === "passage")
  const decision = await evaluateCredential(
    integration,
    uid,
    requiresActiveSubscription,
  )
  const externalEventId = event.externalEventId?.trim() || deterministicEventId(integration.id, event)
  const occurredAtIso = occurredAt.toISOString()
  const fingerprint = accessEventFingerprint(event, uid, occurredAtIso)
  const storedPayload = event.payload ?? {
    deviceId: event.deviceId ?? null,
    doorId: event.doorId ?? null,
  }

  const atomicRpc = vendorResultAllowsProcessing(event.eventType, event.result)
    && decision.allowed
    && decision.clientId
    ? event.eventType === "access_request"
      ? "reserve_access_control_entry"
      : event.eventType === "passage" && event.direction === "entry"
        ? "process_access_control_entry"
        : null
    : null

  if (atomicRpc && decision.clientId) {
    const { data: rpcResult, error: rpcError } = await service.rpc(atomicRpc, {
      p_integration_id: integration.id,
      p_club_id: integration.club_id,
      p_provider: integration.provider,
      p_external_event_id: externalEventId,
      p_credential_uid: uid,
      p_client_id: decision.clientId,
      p_occurred_at: occurredAtIso,
      p_event_fingerprint: fingerprint,
      p_access_request_id: event.accessRequestId ?? null,
      p_payload: storedPayload,
    })
    if (rpcError) {
      return { allowed: false, reasonCode: "processing_error", reasonMessage: "Не удалось обработать событие" }
    }

    if (!event.simulated) {
      await service.from("access_control_integrations").update({
        status: "connected",
        last_seen_at: new Date().toISOString(),
        last_event_at: occurredAt.toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", integration.id).eq("club_id", integration.club_id)
    }

    const result = rpcResult as {
      allowed?: boolean
      reasonCode?: string
      visitId?: string
      subscriptionId?: string
    }
    const reasonCode = result.reasonCode ?? decision.reasonCode
    return {
      ...decision,
      allowed: result.allowed === true,
      reasonCode,
      reasonMessage: decisionMessage(reasonCode, decision.reasonMessage),
      visitId: result.visitId,
      subscriptionId: result.subscriptionId ?? decision.subscriptionId,
    }
  }

  const initialDecision = event.result === "denied" ? "denied" : "received"
  const { data: inserted, error: insertError } = await service
    .from("access_control_events")
    .insert({
      club_id: integration.club_id,
      integration_id: integration.id,
      provider: integration.provider,
      external_event_id: externalEventId,
      event_fingerprint: fingerprint,
      event_type: event.eventType,
      direction: event.direction,
      credential_uid: uid,
      client_id: decision.clientId ?? null,
      subscription_id: decision.subscriptionId ?? null,
      decision: initialDecision,
      reason_code: event.result === "denied" ? "vendor_denied" : null,
      reason_message: event.result === "denied" ? "Проход отклонён системой контроля доступа" : null,
      occurred_at: occurredAtIso,
      payload: storedPayload,
      processed_at: event.result === "denied" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (insertError?.code === "23505") {
    const { data: duplicate } = await service
      .from("access_control_events")
      .select("event_fingerprint,decision,reason_code,reason_message,visit_id,client_id,subscription_id")
      .eq("integration_id", integration.id)
      .eq("event_type", event.eventType)
      .eq("external_event_id", externalEventId)
      .maybeSingle()
    if (!duplicate || duplicate.event_fingerprint !== fingerprint) {
      return {
        allowed: false,
        reasonCode: "idempotency_conflict",
        reasonMessage: "ID события уже использован для другого прохода",
      }
    }
    return {
      allowed: duplicate?.decision === "allowed",
      reasonCode: duplicate?.reason_code ?? "duplicate",
      reasonMessage: duplicate?.reason_message ?? "Событие уже обработано",
      clientId: duplicate?.client_id ?? undefined,
      subscriptionId: duplicate?.subscription_id ?? undefined,
      visitId: duplicate?.visit_id ?? undefined,
      duplicate: true,
    }
  }
  if (insertError || !inserted) {
    return { allowed: false, reasonCode: "storage_error", reasonMessage: "Не удалось сохранить событие" }
  }

  if (!event.simulated) {
    await service.from("access_control_integrations").update({
      status: "connected",
      last_seen_at: new Date().toISOString(),
      last_event_at: occurredAt.toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id).eq("club_id", integration.club_id)
  }

  if (event.result === "denied") {
    return { ...decision, allowed: false, reasonCode: "vendor_denied", reasonMessage: "Проход отклонён системой контроля доступа" }
  }

  if (event.result !== "allowed") {
    await service.from("access_control_events").update({
      decision: "denied",
      reason_code: "vendor_result_unconfirmed",
      reason_message: "Проход не подтверждён системой контроля доступа",
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id).eq("club_id", integration.club_id)
    return {
      ...decision,
      allowed: false,
      reasonCode: "vendor_result_unconfirmed",
      reasonMessage: "Проход не подтверждён системой контроля доступа",
    }
  }

  if (!decision.allowed || !decision.clientId) {
    await service.from("access_control_events").update({
      decision: "denied",
      reason_code: decision.reasonCode,
      reason_message: decision.reasonMessage,
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id).eq("club_id", integration.club_id)
    return decision
  }

  if (event.direction !== "entry" || event.eventType !== "passage") {
    await service.from("access_control_events").update({
      decision: "ignored",
      reason_code: "no_entry_visit",
      reason_message: "Событие сохранено без создания посещения",
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id).eq("club_id", integration.club_id)
    return { ...decision, reasonCode: "no_entry_visit", reasonMessage: "Событие сохранено без создания посещения" }
  }

  return decision
}

export type AuthenticatedIntegration = IntegrationRow
