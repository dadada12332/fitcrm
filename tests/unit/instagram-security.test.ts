import { createHmac } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import {
  decryptIntegrationSecret, decryptSecret, encryptIntegrationSecret, encryptSecret,
} from "../../src/lib/crypto"
import { parseSignedRequest, verifyMetaSignature } from "../../src/lib/instagram-security"

const previousKey = process.env.PAYMENT_ENC_KEY
afterEach(() => { process.env.PAYMENT_ENC_KEY = previousKey })

describe("Instagram integration secrets", () => {
  it("encrypts integration tokens with a separate purpose key", () => {
    process.env.PAYMENT_ENC_KEY = "unit-test-key"
    const integration = encryptIntegrationSecret("instagram-token")
    const payment = encryptSecret("payment-token")
    expect(decryptIntegrationSecret(integration)).toBe("instagram-token")
    expect(decryptSecret(payment)).toBe("payment-token")
    expect(() => decryptSecret(integration)).toThrow()
    expect(() => decryptIntegrationSecret(payment)).toThrow()
  })
})

describe("Meta request signatures", () => {
  it("accepts valid webhook signatures and rejects tampering", () => {
    const secret = "meta-secret"
    const body = JSON.stringify({ object: "instagram", entry: [{ id: "42" }] })
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
    expect(verifyMetaSignature(body, signature, secret)).toBe(true)
    expect(verifyMetaSignature(`${body} `, signature, secret)).toBe(false)
  })

  it("validates Meta data-deletion signed requests", () => {
    const secret = "meta-secret"
    const payload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "42" })).toString("base64url")
    const signature = createHmac("sha256", secret).update(payload).digest("base64url")
    expect(parseSignedRequest(`${signature}.${payload}`, secret)?.user_id).toBe("42")
    expect(parseSignedRequest(`wrong.${payload}`, secret)).toBeNull()
  })
})
