import { createServer } from "node:http"
import { createHash, timingSafeEqual } from "node:crypto"
import { join } from "node:path"
import { FitCrmCloudClient } from "./cloud-client.mjs"
import { CheckpointStore } from "./checkpoint-store.mjs"
import { DurableQueue } from "./durable-queue.mjs"
import { createLogger } from "./logger.mjs"
import { normalizeEvent } from "./normalizer.mjs"
import { loadAdapter } from "./adapters/index.mjs"

function writeJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify(body))
}

async function readJsonBody(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new Error("payload_too_large")
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new Error("invalid_json")
  }
}

function safeSecretEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"
}

export class BridgeService {
  constructor(config, dependencies = {}) {
    this.config = config
    this.logger = dependencies.logger ?? createLogger()
    this.cloud = dependencies.cloud ?? new FitCrmCloudClient(config.fitcrm, {
      fetchImpl: dependencies.fetchImpl,
      logger: this.logger,
    })
    this.queue = dependencies.queue ?? new DurableQueue(join(config.bridge.stateDir, "queue"), {
      maxEntries: config.bridge.maxQueueEntries,
      maxBytes: config.bridge.maxQueueBytes,
      maxFailureFiles: config.bridge.maxFailureFiles,
    })
    this.checkpoints = dependencies.checkpoints ?? new CheckpointStore(join(config.bridge.stateDir, "checkpoints"))
    this.checkpointKey = `${config.provider.type}-${createHash("sha256")
      .update(JSON.stringify([
        config.fitcrm.integrationId,
        config.bridge.id,
        config.provider.baseUrl ?? "",
      ]))
      .digest("hex")
      .slice(0, 24)}`
    this.adapterFactory = dependencies.adapterFactory ?? loadAdapter
    this.adapter = null
    this.server = null
    this.deliveryTimer = null
    this.heartbeatTimer = null
    this.startedAt = null
    this.lastEventAt = null
    this.lastError = null
    this.delivering = false
  }

  async handleProviderEvent(rawEvent) {
    const event = normalizeEvent(rawEvent, this.config.provider.type, this.config.mapping)
    this.lastEventAt = new Date().toISOString()
    if (event.eventType === "access_request") {
      try {
        const decision = await this.cloud.decision(event)
        if (typeof rawEvent.respond === "function") await rawEvent.respond(decision)
        return decision
      } catch (error) {
        this.lastError = error.message
        this.logger.error("Access decision failed closed", { error: error.message, eventId: event.externalEventId })
        const denied = { allowed: false, reasonCode: "bridge_cloud_unavailable" }
        if (typeof rawEvent.respond === "function") await rawEvent.respond(denied)
        return denied
      }
    }

    await this.queue.enqueue(event)
    await this.deliverQueue()
    return { queued: true }
  }

  async deliverQueue() {
    if (this.delivering) return
    this.delivering = true
    try {
      for (const entry of await this.queue.due()) {
        try {
          await this.cloud.event(entry.data.payload)
          await this.queue.acknowledge(entry.path)
          this.lastError = null
        } catch (error) {
          this.lastError = error.message
          if (error.retryable === false) {
            this.logger.error("Moving non-retryable event to dead letter", {
              eventId: entry.data.payload?.externalEventId,
              error: error.message,
            })
            await this.queue.deadLetter(entry, error)
          } else {
            await this.queue.retry(entry, error)
          }
        }
      }
    } finally {
      this.delivering = false
    }
  }

  async health() {
    return {
      ok: this.startedAt !== null && this.lastError === null,
      version: "0.1.0",
      bridgeId: this.config.bridge.id,
      provider: this.config.provider.type,
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      lastError: this.lastError,
      queueDepth: await this.queue.size(),
      adapter: this.adapter?.health?.() ?? { status: "not_started" },
    }
  }

  async start() {
    await this.queue.init()
    this.adapter = await this.adapterFactory(this.config.provider, {
      logger: this.logger,
      mapping: this.config.mapping,
      fetch: globalThis.fetch,
      fetchImpl: globalThis.fetch,
      loadCheckpoint: () => this.checkpoints.load(this.checkpointKey),
      saveCheckpoint: (value) => this.checkpoints.save(this.checkpointKey, value),
    })
    const connection = await this.adapter.testConnection()
    if (!connection?.ok) throw new Error(connection?.error || "Provider connection test failed")
    await this.adapter.start((event) => this.handleProviderEvent(event))
    this.startedAt = new Date().toISOString()

    this.deliveryTimer = setInterval(() => {
      this.deliverQueue().catch((error) => this.logger.error("Queue delivery failed", { error: error.message }))
    }, this.config.bridge.deliveryIntervalMs)
    this.deliveryTimer.unref?.()

    this.heartbeatTimer = setInterval(() => {
      this.cloud.heartbeat(this.config.bridge.id).catch((error) => {
        this.lastError = error.message
        this.logger.warn("Heartbeat failed", { error: error.message })
      })
    }, this.config.bridge.heartbeatIntervalMs)
    this.heartbeatTimer.unref?.()

    this.server = createServer(async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        return writeJson(response, 200, await this.health())
      }
      if (request.method === "POST" && request.url === "/doctor") {
        if (!isLoopback(request.socket.remoteAddress)) {
          return writeJson(response, 403, { ok: false, error: "loopback_only" })
        }
        try {
          return writeJson(response, 200, await this.adapter.testConnection())
        } catch (error) {
          return writeJson(response, 503, { ok: false, error: error.message })
        }
      }
      if (request.method === "POST" && request.url === `/vendor/${this.config.provider.type}`) {
        if (typeof this.adapter.ingest !== "function") {
          return writeJson(response, 405, { ok: false, error: "provider_ingress_not_supported" })
        }
        if (!safeSecretEqual(request.headers["x-fitcrm-vendor-key"], this.config.provider.ingressKey)) {
          return writeJson(response, 401, { ok: false, error: "unauthorized" })
        }
        try {
          const payload = await readJsonBody(request, 256 * 1024)
          const count = await this.adapter.ingest(payload, (event) => this.handleProviderEvent(event))
          return writeJson(response, 202, { ok: true, accepted: count })
        } catch (error) {
          const status = error.message === "payload_too_large" ? 413 : 400
          return writeJson(response, status, { ok: false, error: error.message })
        }
      }
      return writeJson(response, 404, { ok: false, error: "not_found" })
    })
    await new Promise((resolve, reject) => {
      this.server.once("error", reject)
      this.server.listen(this.config.bridge.listenPort, this.config.bridge.listenHost, resolve)
    })
    this.logger.info("FitCRM Bridge started", {
      bridgeId: this.config.bridge.id,
      provider: this.config.provider.type,
      address: `${this.config.bridge.listenHost}:${this.config.bridge.listenPort}`,
    })
  }

  async stop() {
    if (this.deliveryTimer) clearInterval(this.deliveryTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    await this.adapter?.stop?.()
    if (this.server) await new Promise((resolve) => this.server.close(resolve))
    this.startedAt = null
  }
}
