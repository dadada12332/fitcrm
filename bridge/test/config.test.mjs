import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig, redactConfig, validateConfig } from "../src/config.mjs"

const valid = {
  bridge: { id: "test", stateDir: "./data" },
  fitcrm: {
    baseUrl: "https://fitcrm.example",
    integrationId: "integration-id",
    accessKey: "secret",
  },
  provider: { type: "mock" },
}

test("validates and normalizes bridge config", () => {
  const config = validateConfig(valid, "/tmp/config.json")
  assert.equal(config.bridge.listenHost, "127.0.0.1")
  assert.equal(config.provider.type, "mock")
  assert.equal(config.fitcrm.baseUrl, "https://fitcrm.example")
})

test("rejects insecure remote FitCRM URL", () => {
  assert.throws(
    () => validateConfig({ ...valid, fitcrm: { ...valid.fitcrm, baseUrl: "http://fitcrm.example" } }),
    /HTTPS/,
  )
})

test("allows the service installer to override the durable state directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-bridge-config-"))
  const path = join(directory, "config.json")
  await writeFile(path, JSON.stringify({
    bridge: { id: "test" },
    fitcrm: {
      baseUrl: "https://fitcrm.example",
      integrationId: "integration",
      accessKey: "secret",
    },
    provider: { type: "mock" },
  }))

  const config = await loadConfig(path, {
    FITCRM_BRIDGE_STATE_DIR: "/var/lib/fitcrm-bridge",
  })

  assert.equal(config.bridge.stateDir, "/var/lib/fitcrm-bridge")
})

test("recursively redacts nested credentials and custom headers", () => {
  const redacted = redactConfig({
    fitcrm: { accessKey: "cloud-secret" },
    provider: {
      auth: {
        token: "vendor-token",
        ingressKey: "ingress-secret",
        body: { username: "bridge", password: "vendor-secret" },
        headers: {
          Authorization: "Bearer nested",
          "X-Vendor-Session": "opaque-secret",
        },
      },
    },
  })

  assert.equal(redacted.fitcrm.accessKey, "[redacted]")
  assert.equal(redacted.provider.auth.token, "[redacted]")
  assert.equal(redacted.provider.auth.ingressKey, "[redacted]")
  assert.equal(redacted.provider.auth.body.password, "[redacted]")
  assert.equal(redacted.provider.auth.headers.Authorization, "[redacted]")
  assert.equal(redacted.provider.auth.headers["X-Vendor-Session"], "[redacted]")
  assert.equal(redacted.provider.auth.body.username, "bridge")
})
