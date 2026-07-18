import { describe, expect, it } from "vitest"
import { createQrPass, validateQrPass } from "../../src/lib/qr-pass"

const CLUB = "11111111-1111-4111-8111-111111111111"
const CLIENT = "22222222-2222-4222-8222-222222222222"

describe("dynamic QR passes", () => {
  it("signs a club-scoped pass for 30 seconds", () => {
    process.env.QR_SIGNING_SECRET = "test-qr-secret"
    const pass = createQrPass(CLUB, CLIENT, 1_800_000_000)
    const payload = validateQrPass(pass.value, CLUB, 1_800_000_015)
    expect(payload?.clientId).toBe(CLIENT)
    expect(payload?.exp).toBe(1_800_000_030)
    expect(pass.expiresAt).toBe("2027-01-15T08:00:30.000Z")
  })

  it("rejects tampering, another club and an expired screenshot", () => {
    process.env.QR_SIGNING_SECRET = "test-qr-secret"
    const pass = createQrPass(CLUB, CLIENT, 1_800_000_000)
    const anotherClub = "33333333-3333-4333-8333-333333333333"
    expect(validateQrPass(`${pass.value}x`, CLUB, 1_800_000_010)).toBeNull()
    expect(validateQrPass(pass.value, anotherClub, 1_800_000_010)).toBeNull()
    expect(validateQrPass(pass.value, CLUB, 1_800_000_031)).toBeNull()
  })
})
