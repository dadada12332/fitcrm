import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

const PROVIDERS = new Set(["sigur", "zkteco", "hikvision", "mock"])

function expandEnvironment(value, environment) {
  if (Array.isArray(value)) return value.map((item) => expandEnvironment(item, environment))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandEnvironment(item, environment)]),
    )
  }
  if (typeof value !== "string") return value
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    const resolved = environment[name]
    if (resolved === undefined || resolved === "") throw new Error(`Missing environment variable: ${name}`)
    return resolved
  })
}

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function boundedNumber(value, fallback, min, max, field) {
  const number = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be between ${min} and ${max}`)
  }
  return number
}

export function validateConfig(input, configPath = process.cwd()) {
  if (!input || typeof input !== "object") throw new Error("Bridge config must be an object")
  const bridge = input.bridge ?? {}
  const fitcrm = input.fitcrm ?? {}
  const provider = input.provider ?? {}
  const mapping = input.mapping ?? {}
  const providerType = requireString(provider.type, "provider.type").toLowerCase()
  if (!PROVIDERS.has(providerType)) throw new Error(`Unsupported provider.type: ${providerType}`)

  const fitcrmUrl = new URL(requireString(fitcrm.baseUrl, "fitcrm.baseUrl"))
  if (fitcrmUrl.protocol !== "https:" && fitcrmUrl.hostname !== "127.0.0.1" && fitcrmUrl.hostname !== "localhost") {
    throw new Error("fitcrm.baseUrl must use HTTPS outside localhost")
  }

  const baseDir = isAbsolute(configPath) ? resolve(configPath, "..") : process.cwd()
  const stateDirValue = typeof bridge.stateDir === "string" && bridge.stateDir ? bridge.stateDir : "./data"

  return {
    bridge: {
      id: requireString(bridge.id ?? "default-bridge", "bridge.id"),
      listenHost: requireString(bridge.listenHost ?? "127.0.0.1", "bridge.listenHost"),
      listenPort: boundedNumber(bridge.listenPort, 8787, 1, 65535, "bridge.listenPort"),
      stateDir: isAbsolute(stateDirValue) ? stateDirValue : resolve(baseDir, stateDirValue),
      heartbeatIntervalMs: boundedNumber(
        bridge.heartbeatIntervalMs,
        60_000,
        10_000,
        3_600_000,
        "bridge.heartbeatIntervalMs",
      ),
      deliveryIntervalMs: boundedNumber(
        bridge.deliveryIntervalMs,
        1_000,
        250,
        60_000,
        "bridge.deliveryIntervalMs",
      ),
      maxQueueEntries: boundedNumber(
        bridge.maxQueueEntries,
        100_000,
        100,
        1_000_000,
        "bridge.maxQueueEntries",
      ),
      maxQueueBytes: boundedNumber(
        bridge.maxQueueBytes,
        512 * 1024 * 1024,
        1024 * 1024,
        10 * 1024 * 1024 * 1024,
        "bridge.maxQueueBytes",
      ),
      maxFailureFiles: boundedNumber(
        bridge.maxFailureFiles,
        10_000,
        10,
        100_000,
        "bridge.maxFailureFiles",
      ),
    },
    fitcrm: {
      baseUrl: fitcrmUrl.toString().replace(/\/$/, ""),
      integrationId: requireString(fitcrm.integrationId, "fitcrm.integrationId"),
      accessKey: requireString(fitcrm.accessKey, "fitcrm.accessKey"),
      timeoutMs: boundedNumber(fitcrm.timeoutMs, 5_000, 500, 30_000, "fitcrm.timeoutMs"),
    },
    provider: {
      ...provider,
      type: providerType,
      pollIntervalMs: boundedNumber(provider.pollIntervalMs, 1_000, 250, 300_000, "provider.pollIntervalMs"),
      requestTimeoutMs: boundedNumber(provider.requestTimeoutMs, 5_000, 500, 60_000, "provider.requestTimeoutMs"),
    },
    mapping: {
      entryReaders: Array.isArray(mapping.entryReaders) ? mapping.entryReaders.map(String) : [],
      exitReaders: Array.isArray(mapping.exitReaders) ? mapping.exitReaders.map(String) : [],
      timezone: requireString(mapping.timezone ?? "Asia/Tashkent", "mapping.timezone"),
    },
  }
}

export async function loadConfig(path, environment = process.env) {
  const configPath = resolve(path || environment.FITCRM_BRIDGE_CONFIG || "./config.json")
  const source = await readFile(configPath, "utf8")
  const parsed = JSON.parse(source)
  if (environment.FITCRM_BRIDGE_STATE_DIR) {
    parsed.bridge = {
      ...(parsed.bridge ?? {}),
      stateDir: environment.FITCRM_BRIDGE_STATE_DIR,
    }
  }
  return validateConfig(expandEnvironment(parsed, environment), configPath)
}

const SENSITIVE_KEY = /(password|secret|token|authorization|api.?key|access.?key|private.?key|ingress.?key|cookie)/i

function redactValue(value, key = "") {
  if (SENSITIVE_KEY.test(key)) return value === undefined ? undefined : "[redacted]"
  if (/headers$/i.test(key) && value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.keys(value).map((header) => [header, "[redacted]"]))
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, childKey),
      ]),
    )
  }
  return value
}

export function redactConfig(config) {
  return redactValue(config)
}
