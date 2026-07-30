import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { open, stat } from "node:fs/promises"
import { once } from "node:events"

const [mode, input, output] = process.argv.slice(2)
const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE
if (!["encrypt", "decrypt"].includes(mode) || !input || !output || !passphrase) {
  throw new Error(
    "Usage: BACKUP_ENCRYPTION_PASSPHRASE=... node scripts/backup-crypto.mjs <encrypt|decrypt> <input> <output>",
  )
}

const MAGIC = Buffer.from("ZALKINS_BACKUP_V1")

if (mode === "encrypt") {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const destination = createWriteStream(output, { mode: 0o600 })
  destination.write(Buffer.concat([MAGIC, salt, iv]))
  createReadStream(input).pipe(cipher).pipe(destination, { end: false })
  await once(cipher, "end")
  destination.end(cipher.getAuthTag())
  await once(destination, "finish")
} else {
  const headerSize = MAGIC.length + 16 + 12
  const { size } = await stat(input)
  if (size <= headerSize + 16) {
    throw new Error("Invalid encrypted backup format")
  }
  const file = await open(input, "r")
  const header = Buffer.alloc(headerSize)
  const authTag = Buffer.alloc(16)
  await file.read(header, 0, header.length, 0)
  await file.read(authTag, 0, authTag.length, size - authTag.length)
  await file.close()
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Invalid encrypted backup format")
  }
  const salt = header.subarray(MAGIC.length, MAGIC.length + 16)
  const iv = header.subarray(MAGIC.length + 16)
  const key = scryptSync(passphrase, salt, 32)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  const destination = createWriteStream(output, { mode: 0o600 })
  createReadStream(input, { start: headerSize, end: size - authTag.length - 1 })
    .pipe(decipher)
    .pipe(destination)
  await once(destination, "finish")
}
