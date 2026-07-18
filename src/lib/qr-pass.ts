import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const PREFIX = "fitcrm.qr.v1"
const TTL_SECONDS = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type QrPassPayload = {
  clubId: string
  clientId: string
  exp: number
  jti: string
}

function signingKey() {
  const source = process.env.QR_SIGNING_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!source) throw new Error("QR signing secret is missing")
  return createHmac("sha256", source).update("fitcrm-dynamic-qr-v1").digest()
}

function sign(encodedPayload: string) {
  return createHmac("sha256", signingKey()).update(`${PREFIX}.${encodedPayload}`).digest("base64url")
}

export function createQrPass(clubId: string, clientId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!UUID.test(clubId) || !UUID.test(clientId)) throw new Error("Invalid QR pass subject")
  const payload: QrPassPayload = {
    clubId,
    clientId,
    exp: nowSeconds + TTL_SECONDS,
    jti: randomBytes(12).toString("base64url"),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return {
    value: `${PREFIX}.${encodedPayload}.${sign(encodedPayload)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  }
}

export function validateQrPass(value: string, expectedClubId: string, nowSeconds = Math.floor(Date.now() / 1000)): QrPassPayload | null {
  if (!value || value.length > 1024 || !UUID.test(expectedClubId)) return null
  const parts = value.split(".")
  if (parts.length !== 5 || parts.slice(0, 3).join(".") !== PREFIX) return null
  const encodedPayload = parts[3]
  const received = Buffer.from(parts[4], "base64url")
  const expected = Buffer.from(sign(encodedPayload), "base64url")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as QrPassPayload
    if (!UUID.test(payload.clubId) || !UUID.test(payload.clientId) || payload.clubId !== expectedClubId) return null
    if (!Number.isInteger(payload.exp) || payload.exp < nowSeconds || payload.exp > nowSeconds + TTL_SECONDS + 5) return null
    if (!/^[A-Za-z0-9_-]{16}$/.test(payload.jti)) return null
    return payload
  } catch {
    return null
  }
}
