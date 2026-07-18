import { createHmac, timingSafeEqual } from "node:crypto"

export type TelegramMiniAppUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export type ValidatedTelegramInitData = {
  authDate: number
  queryId: string | null
  user: TelegramMiniAppUser
}

export function validateTelegramMiniAppInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 10 * 60,
): ValidatedTelegramInitData | null {
  if (!initData || initData.length > 8192 || !botToken) return null

  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")
  const authDate = Number(params.get("auth_date"))
  const rawUser = params.get("user")
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isInteger(authDate) || !rawUser) return null
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) return null

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest()
  const received = Buffer.from(receivedHash, "hex")
  if (received.length !== calculatedHash.length || !timingSafeEqual(received, calculatedHash)) return null

  try {
    const user = JSON.parse(rawUser) as TelegramMiniAppUser
    if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.first_name) return null
    return { authDate, queryId: params.get("query_id"), user }
  } catch {
    return null
  }
}
