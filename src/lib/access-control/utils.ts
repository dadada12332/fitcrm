import crypto from "crypto"
import {
  ACCESS_CONTROL_PROVIDERS,
  type NormalizedAccessEvent,
  type AccessControlProvider,
} from "./types"

export function isAccessControlProvider(value: string): value is AccessControlProvider {
  return ACCESS_CONTROL_PROVIDERS.includes(value as AccessControlProvider)
}

export function normalizeCredentialUid(value: string) {
  const normalized = value.normalize("NFKC").trim()
  if (!normalized || normalized.length > 128) {
    throw new Error("Идентификатор должен содержать от 1 до 128 символов")
  }
  return normalized
}

export function hashWebhookKey(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex")
}

export function accessEventFingerprint(
  event: NormalizedAccessEvent,
  credentialUid: string,
  occurredAtIso: string,
) {
  return crypto.createHash("sha256").update(JSON.stringify([
    event.eventType,
    event.direction,
    event.result,
    credentialUid,
    occurredAtIso,
    event.deviceId ?? "",
    event.doorId ?? "",
    event.accessRequestId ?? "",
  ])).digest("hex")
}

export function vendorResultAllowsProcessing(
  eventType: NormalizedAccessEvent["eventType"],
  result: NormalizedAccessEvent["result"],
) {
  return eventType === "access_request" ? result !== "denied" : result === "allowed"
}
