import crypto from "crypto"

export function instagramStateHash(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex")
}

export function verifyMetaSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=") || !secret) return false
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

export function parseSignedRequest(value: string, secret: string): Record<string, unknown> | null {
  const [encodedSignature, payload] = value.split(".")
  if (!encodedSignature || !payload || !secret) return null
  const decode = (part: string) => Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  const signature = decode(encodedSignature)
  const expected = crypto.createHmac("sha256", secret).update(payload).digest()
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(decode(payload).toString("utf8")) as Record<string, unknown>
    return parsed.algorithm === "HMAC-SHA256" ? parsed : null
  } catch {
    return null
  }
}
