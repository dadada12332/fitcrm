import { createHash, randomBytes } from "node:crypto"

const PAIRING_PREFIX = "staff_"
const PAIRING_TTL_MS = 15 * 60 * 1000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/

export function hashTelegramPairingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function createTelegramPairing(now = Date.now()) {
  const token = randomBytes(24).toString("base64url")
  return {
    payload: `${PAIRING_PREFIX}${token}`,
    tokenHash: hashTelegramPairingToken(token),
    expiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
  }
}

export function parseTelegramPairingPayload(payload: string): string | null {
  if (!payload.startsWith(PAIRING_PREFIX)) return null
  const token = payload.slice(PAIRING_PREFIX.length)
  return TOKEN_PATTERN.test(token) ? token : null
}
