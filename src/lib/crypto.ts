import crypto from "crypto"

// Шифрование секретов мерчанта (ключи Payme/Click) — AES-256-GCM.
// Ключ деривится из PAYMENT_ENC_KEY (если задан) либо из SERVICE_ROLE_KEY,
// чтобы работать на Vercel без добавления env. Данные остаются расшифровываемыми
// между деплоями (ключ детерминирован). TODO: вынести в выделенный KMS-ключ.
function getKey(): Buffer {
  const src = process.env.PAYMENT_ENC_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!src) throw new Error("encryption key source missing")
  return crypto.createHash("sha256").update(src + "::fitcrm-payment-creds-v1").digest()
}

/** Зашифровать строку → base64(iv[12] + tag[16] + ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

/** Расшифровать blob обратно в строку. Бросает при подделке (GCM auth). */
export function decryptSecret(blob: string): string {
  const raw = Buffer.from(blob, "base64")
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const enc = raw.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

/** Последние N символов секрета для маски в UI (без раскрытия). */
export function lastN(s: string, n = 4): string {
  return s.length <= n ? s : s.slice(-n)
}
