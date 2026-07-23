import { describe, expect, it } from "vitest"
import {
  accessEventFingerprint,
  hashWebhookKey,
  isAccessControlProvider,
  normalizeCredentialUid,
  vendorResultAllowsProcessing,
} from "../../src/lib/access-control/utils"

describe("access-control integration primitives", () => {
  it("keeps card identifiers opaque, including leading zeros and case", () => {
    expect(normalizeCredentialUid("  0012Ab  ")).toBe("0012Ab")
  })

  it("rejects empty and oversized credential identifiers", () => {
    expect(() => normalizeCredentialUid("   ")).toThrow()
    expect(() => normalizeCredentialUid("x".repeat(129))).toThrow()
  })

  it("recognizes only supported providers", () => {
    expect(isAccessControlProvider("sigur")).toBe(true)
    expect(isAccessControlProvider("zkteco")).toBe(true)
    expect(isAccessControlProvider("hikvision")).toBe(true)
    expect(isAccessControlProvider("unknown")).toBe(false)
  })

  it("hashes webhook keys deterministically without storing the key", () => {
    const hash = hashWebhookKey("test-key")
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(hashWebhookKey("test-key"))
    expect(hash).not.toContain("test-key")
  })

  it("fingerprints every field that changes idempotency semantics", () => {
    const base = {
      externalEventId: "evt-1",
      eventType: "passage" as const,
      direction: "entry" as const,
      result: "allowed" as const,
      credentialUid: "0012Ab",
      occurredAt: "2026-07-23T12:00:00.000Z",
      deviceId: "reader-1",
      doorId: "main",
      accessRequestId: "request-1",
    }
    const fingerprint = accessEventFingerprint(base, "0012Ab", base.occurredAt)
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(accessEventFingerprint({ ...base, result: "denied" }, "0012Ab", base.occurredAt)).not.toBe(fingerprint)
    expect(accessEventFingerprint({ ...base, eventType: "access_request" }, "0012Ab", base.occurredAt)).not.toBe(fingerprint)
    expect(accessEventFingerprint({ ...base, accessRequestId: "request-2" }, "0012Ab", base.occurredAt)).not.toBe(fingerprint)
    expect(accessEventFingerprint(base, "another-card", base.occurredAt)).not.toBe(fingerprint)
  })

  it("lets FitCRM decide access requests but requires confirmed passage", () => {
    expect(vendorResultAllowsProcessing("access_request", "unknown")).toBe(true)
    expect(vendorResultAllowsProcessing("access_request", "denied")).toBe(false)
    expect(vendorResultAllowsProcessing("passage", "unknown")).toBe(false)
    expect(vendorResultAllowsProcessing("passage", "allowed")).toBe(true)
  })
})
