#!/usr/bin/env node
import { loadConfig, redactConfig } from "../src/config.mjs"
import { createLogger } from "../src/logger.mjs"
import { loadAdapter } from "../src/adapters/index.mjs"
import { BridgeService } from "../src/bridge-service.mjs"

const command = process.argv[2] ?? "start"
const configPath = process.argv[3] ?? process.env.FITCRM_BRIDGE_CONFIG ?? "./config.json"
const logger = createLogger()

async function main() {
  const config = await loadConfig(configPath)
  if (command === "print-config") {
    process.stdout.write(`${JSON.stringify(redactConfig(config), null, 2)}\n`)
    return
  }
  if (command === "doctor") {
    const adapter = await loadAdapter(config.provider, { logger, mapping: config.mapping, fetchImpl: globalThis.fetch })
    const result = await adapter.testConnection()
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.ok) process.exitCode = 1
    return
  }
  if (command === "simulate") {
    config.provider = {
      type: "mock",
      pollIntervalMs: 100,
      requestTimeoutMs: 1_000,
      events: [{
        externalEventId: `simulation:${Date.now()}`,
        eventType: "passage",
        direction: "entry",
        result: "allowed",
        credentialUid: process.env.FITCRM_SIMULATE_CREDENTIAL ?? "TEST-CARD",
        occurredAt: new Date().toISOString(),
        deviceId: "bridge-simulator",
      }],
    }
  } else if (command !== "start") {
    throw new Error(`Unknown command: ${command}`)
  }

  const service = new BridgeService(config, { logger })
  await service.start()
  const shutdown = async (signal) => {
    logger.info("Stopping FitCRM Bridge", { signal })
    await service.stop()
    process.exit(0)
  }
  process.once("SIGINT", () => shutdown("SIGINT"))
  process.once("SIGTERM", () => shutdown("SIGTERM"))
}

main().catch((error) => {
  logger.error("FitCRM Bridge failed", { error: error.message })
  process.exitCode = 1
})
