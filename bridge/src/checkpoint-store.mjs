import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"

export class CheckpointStore {
  constructor(directory) {
    this.directory = directory
  }

  path(provider) {
    if (!/^[a-z0-9_-]+$/i.test(provider)) throw new Error("invalid_checkpoint_name")
    return join(this.directory, `${provider}.json`)
  }

  async load(provider) {
    try {
      const value = JSON.parse(await readFile(this.path(provider), "utf8"))
      return value && typeof value === "object" && !Array.isArray(value) ? value : null
    } catch (error) {
      if (error?.code === "ENOENT") return null
      throw error
    }
  }

  async save(provider, value) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const finalPath = this.path(provider)
    const temporaryPath = `${finalPath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600 })
    await rename(temporaryPath, finalPath)
  }
}
