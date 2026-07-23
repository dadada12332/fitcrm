import "server-only"

import type { NextRequest } from "next/server"
import type { NormalizedAccessEvent } from "@/lib/access-control/types"

const MAX_BODY_BYTES = 32 * 1024
const SENSITIVE_KEY = /(authorization|api.?key|cookie|credential|password|secret|session|token|pin|card|photo|image|face|finger|biometric|template)/i

function cleanPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]"
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => cleanPayload(item, depth + 1))
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}…`
    return value
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : cleanPayload(item, depth + 1)]),
  )
}

export function accessControlRequestKey(request: NextRequest) {
  const direct = request.headers.get("x-fitcrm-access-key")?.trim()
  if (direct) return direct
  const authorization = request.headers.get("authorization") ?? ""
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : ""
}

export async function parseNormalizedAccessEvent(
  request: NextRequest,
  forceType?: NormalizedAccessEvent["eventType"],
): Promise<NormalizedAccessEvent> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
  if (!contentType.startsWith("application/json")) throw new Error("unsupported_content_type")
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("payload_too_large")
  }
  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new Error("payload_too_large")

  let body: Record<string, unknown>
  try {
    body = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error("invalid_json")
  }
  if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("invalid_payload")

  const credentialUid = typeof body.credentialUid === "string" ? body.credentialUid : undefined
  const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString()
  const eventType = forceType ?? (
    ["access_request", "passage", "denied", "heartbeat", "unknown"].includes(String(body.eventType))
      ? body.eventType as NormalizedAccessEvent["eventType"]
      : "unknown"
  )
  const direction = ["entry", "exit", "unknown"].includes(String(body.direction))
    ? body.direction as NormalizedAccessEvent["direction"]
    : "unknown"
  const result = ["allowed", "denied", "unknown"].includes(String(body.result))
    ? body.result as NormalizedAccessEvent["result"]
    : "unknown"

  if (eventType !== "heartbeat" && !credentialUid) throw new Error("credential_missing")
  if ((eventType === "access_request" || eventType === "passage") && typeof body.externalEventId !== "string") {
    throw new Error("external_event_id_required")
  }
  if (typeof body.externalEventId === "string" && (body.externalEventId.trim().length === 0 || body.externalEventId.length > 300)) {
    throw new Error("external_event_id_invalid")
  }
  if (typeof body.accessRequestId === "string" && (body.accessRequestId.trim().length === 0 || body.accessRequestId.length > 300)) {
    throw new Error("access_request_id_invalid")
  }
  if (credentialUid && credentialUid.length > 128) throw new Error("credential_too_long")
  if (Number.isNaN(new Date(occurredAt).getTime())) throw new Error("invalid_timestamp")

  return {
    externalEventId: typeof body.externalEventId === "string" ? body.externalEventId.trim() : undefined,
    eventType,
    direction,
    result,
    credentialUid,
    occurredAt,
    deviceId: typeof body.deviceId === "string" ? body.deviceId.slice(0, 200) : undefined,
    doorId: typeof body.doorId === "string" ? body.doorId.slice(0, 200) : undefined,
    accessRequestId: typeof body.accessRequestId === "string" ? body.accessRequestId.trim() : undefined,
    simulated: false,
    payload: cleanPayload(body.payload ?? body) as Record<string, unknown>,
  }
}

export function accessControlErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "invalid_request"
  const status = code === "payload_too_large"
    ? 413
    : code === "backend_unavailable"
      ? 503
      : 400
  return Response.json({ ok: false, error: code }, { status })
}
