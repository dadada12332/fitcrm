import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"

async function atomicWriteJson(path, value) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600 })
  await rename(temporaryPath, path)
}

export class DurableQueue {
  constructor(directory, {
    now = () => Date.now(),
    maxEntries = 100_000,
    maxBytes = 512 * 1024 * 1024,
    maxFailureFiles = 10_000,
  } = {}) {
    this.directory = directory
    this.now = now
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
    this.maxFailureFiles = maxFailureFiles
  }

  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
  }

  async enqueue(payload) {
    await this.init()
    await this.pruneFailureFiles()
    const id = `${String(this.now()).padStart(16, "0")}-${randomUUID()}`
    const serialized = JSON.stringify({
      id,
      attempt: 0,
      nextAttemptAt: this.now(),
      payload,
    })
    const usage = await this.usage()
    if (usage.activeFiles >= this.maxEntries || usage.totalBytes + Buffer.byteLength(serialized) > this.maxBytes) {
      const error = new Error("durable_queue_capacity_exceeded")
      error.code = "QUEUE_FULL"
      throw error
    }
    const finalPath = join(this.directory, `${id}.json`)
    await atomicWriteJson(finalPath, {
      id,
      attempt: 0,
      nextAttemptAt: this.now(),
      payload,
    })
    return id
  }

  async entries() {
    await this.init()
    const names = (await readdir(this.directory)).filter((name) => name.endsWith(".json")).sort()
    const records = []
    for (const name of names) {
      try {
        records.push({ path: join(this.directory, name), data: JSON.parse(await readFile(join(this.directory, name), "utf8")) })
      } catch {
        await rename(join(this.directory, name), join(this.directory, `${name}.corrupt`)).catch(() => {})
      }
    }
    return records
  }

  async due() {
    const now = this.now()
    return (await this.entries()).filter((entry) => Number(entry.data.nextAttemptAt) <= now)
  }

  async acknowledge(path) {
    await rm(path, { force: true })
  }

  async deadLetter(entry, error) {
    const target = `${entry.path}.dead`
    await atomicWriteJson(target, {
      ...entry.data,
      deadLetteredAt: this.now(),
      lastError: String(error?.message ?? error).slice(0, 300),
    })
    await rm(entry.path, { force: true })
    await this.pruneFailureFiles()
  }

  async retry(entry, error) {
    const attempt = Number(entry.data.attempt ?? 0) + 1
    const backoff = Math.min(300_000, 1_000 * (2 ** Math.min(attempt, 8)))
    await atomicWriteJson(entry.path, {
      ...entry.data,
      attempt,
      nextAttemptAt: this.now() + backoff,
      lastError: String(error?.message ?? error).slice(0, 300),
    })
  }

  async size() {
    return (await this.entries()).length
  }

  async usage() {
    await this.init()
    const names = await readdir(this.directory)
    let totalBytes = 0
    let activeFiles = 0
    for (const name of names) {
      if (!name.endsWith(".json") && !name.endsWith(".dead") && !name.endsWith(".corrupt")) continue
      if (name.endsWith(".json")) activeFiles += 1
      totalBytes += (await stat(join(this.directory, name))).size
    }
    return { totalBytes, activeFiles }
  }

  async pruneFailureFiles() {
    const names = (await readdir(this.directory))
      .filter((name) => name.endsWith(".dead") || name.endsWith(".corrupt"))
      .sort()
    const requiredRemoval = Math.max(0, names.length - this.maxFailureFiles)
    let totalBytes = (await this.usage()).totalBytes
    let removed = 0
    for (const name of names) {
      if (removed >= requiredRemoval && totalBytes <= this.maxBytes) break
      const path = join(this.directory, name)
      const bytes = (await stat(path)).size
      await rm(path, { force: true })
      totalBytes -= bytes
      removed += 1
    }
  }
}
