import { describe, expect, it } from "vitest"
import {
  createTelegramPairing,
  hashTelegramPairingToken,
  parseTelegramPairingPayload,
} from "../../src/lib/telegram/pairing"

describe("Telegram staff pairing", () => {
  it("creates a Bot API-compatible payload with a 15 minute expiry", () => {
    const now = Date.UTC(2026, 6, 18, 12, 0, 0)
    const pairing = createTelegramPairing(now)
    const token = parseTelegramPairingPayload(pairing.payload)

    expect(pairing.payload.length).toBeLessThanOrEqual(64)
    expect(token).not.toBeNull()
    expect(pairing.tokenHash).toBe(hashTelegramPairingToken(token!))
    expect(pairing.expiresAt).toBe("2026-07-18T12:15:00.000Z")
  })

  it("rejects malformed and unrelated start payloads", () => {
    expect(parseTelegramPairingPayload("client_abc")).toBeNull()
    expect(parseTelegramPairingPayload("staff_too-short")).toBeNull()
    expect(parseTelegramPairingPayload("staff_1234567890123456789012345678901!")).toBeNull()
  })
})
