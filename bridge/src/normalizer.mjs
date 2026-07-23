import { createHash } from "node:crypto"

const EVENT_TYPES = new Set(["access_request", "passage", "denied", "heartbeat", "unknown"])
const DIRECTIONS = new Set(["entry", "exit", "unknown"])
const RESULTS = new Set(["allowed", "denied", "unknown"])

function stableEventId(event) {
  return `bridge:${createHash("sha256").update(JSON.stringify([
    event.provider ?? "",
    event.eventType,
    event.deviceId ?? "",
    event.doorId ?? "",
    event.credentialUid ?? "",
    event.occurredAt,
    event.direction,
    event.result,
  ])).digest("hex")}`
}

export function normalizeEvent(input, provider, mapping = {}) {
  if (!input || typeof input !== "object") throw new Error("Provider event must be an object")
  const eventType = EVENT_TYPES.has(input.eventType) ? input.eventType : "unknown"
  const deviceId = input.deviceId === undefined ? undefined : String(input.deviceId).slice(0, 200)
  const doorId = input.doorId === undefined ? undefined : String(input.doorId).slice(0, 200)
  let direction = DIRECTIONS.has(input.direction) ? input.direction : "unknown"
  if (direction === "unknown" && deviceId && mapping.entryReaders?.includes(deviceId)) direction = "entry"
  if (direction === "unknown" && deviceId && mapping.exitReaders?.includes(deviceId)) direction = "exit"
  const result = RESULTS.has(input.result) ? input.result : "unknown"
  const occurredAt = new Date(input.occurredAt ?? Date.now())
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Provider event has invalid occurredAt")
  const credentialUid = input.credentialUid === undefined ? undefined : String(input.credentialUid).normalize("NFKC").trim()
  if (eventType !== "heartbeat" && (!credentialUid || credentialUid.length > 128)) {
    throw new Error("Provider event has invalid credentialUid")
  }

  const normalized = {
    provider,
    externalEventId: input.externalEventId ? String(input.externalEventId).trim() : undefined,
    eventType,
    direction,
    result,
    credentialUid,
    occurredAt: occurredAt.toISOString(),
    deviceId,
    doorId,
    accessRequestId: input.accessRequestId ? String(input.accessRequestId).trim() : undefined,
    payload: input.payload && typeof input.payload === "object" ? input.payload : undefined,
  }
  normalized.externalEventId ||= stableEventId(normalized)
  if (!normalized.externalEventId || normalized.externalEventId.length > 300) {
    throw new Error("Provider event has invalid externalEventId")
  }
  return normalized
}
