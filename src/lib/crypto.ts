import crypto from "crypto"

// Шифрование секретов мерчанта (ключи Payme/Click) — AES-256-GCM.
// Ключ деривится из PAYMENT_ENC_KEY (если задан) либо из SERVICE_ROLE_KEY,
// чтобы работать на Vercel без добавления env. Данные остаются расшифровываемыми
// между деплоями (ключ детерминирован). TODO: вынести в выделенный KMS-ключ.
function getKey(purpose = "payment-creds-v1"): Buffer {
  const src = process.env.PAYMENT_ENC_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!src) throw new Error("encryption key source missing")
  return crypto.createHash("sha256").update(`${src}::fitcrm-${purpose}`).digest()
}

function encryptWithPurpose(plaintext: string, purpose: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(purpose), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")
}

function decryptWithPurpose(blob: string, purpose: string): string {
  const raw = Buffer.from(blob, "base64")
  if (raw.length < 29) throw new Error("invalid encrypted secret")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(purpose), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
}

/** Зашифровать строку → base64(iv[12] + tag[16] + ciphertext). */
export function encryptSecret(plaintext: string): string {
  return encryptWithPurpose(plaintext, "payment-creds-v1")
}

/** Расшифровать blob обратно в строку. Бросает при подделке (GCM auth). */
export function decryptSecret(blob: string): string {
  return decryptWithPurpose(blob, "payment-creds-v1")
}

export function encryptIntegrationSecret(plaintext: string): string {
  return encryptWithPurpose(plaintext, "integration-secrets-v1")
}

export function decryptIntegrationSecret(blob: string): string {
  return decryptWithPurpose(blob, "integration-secrets-v1")
}

/** Последние N символов секрета для маски в UI (без раскрытия). */
export function lastN(s: string, n = 4): string {
  return s.length <= n ? s : s.slice(-n)
}
