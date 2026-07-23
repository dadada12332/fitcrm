import test from "node:test"
import assert from "node:assert/strict"
import { BridgeService } from "../src/bridge-service.mjs"

function config() {
  return {
    bridge: {
      id: "test",
      listenHost: "127.0.0.1",
      listenPort: 8787,
      stateDir: "/tmp/unused",
      heartbeatIntervalMs: 60_000,
      deliveryIntervalMs: 1_000,
    },
    fitcrm: {
      baseUrl: "https://fitcrm.example",
      integrationId: "integration",
      accessKey: "secret",
      timeoutMs: 1_000,
    },
    provider: { type: "mock" },
    mapping: { entryReaders: [], exitReaders: [], timezone: "Asia/Tashkent" },
  }
}

test("fails an online access request closed when cloud is unavailable", async () => {
  let response
  const service = new BridgeService(config(), {
    logger: { info() {}, warn() {}, error() {} },
    cloud: {
      decision: async () => { throw new Error("offline") },
    },
    queue: { enqueue: async () => {}, due: async () => [], size: async () => 0 },
  })
  const result = await service.handleProviderEvent({
    externalEventId: "request-1",
    eventType: "access_request",
    direction: "entry",
    result: "unknown",
    credentialUid: "0012",
    occurredAt: new Date().toISOString(),
    respond: async (decision) => { response = decision },
  })
  assert.equal(result.allowed, false)
  assert.equal(response.reasonCode, "bridge_cloud_unavailable")
})

test("queues a confirmed passage before delivery", async () => {
  const calls = []
  const entry = {
    path: "/queue/event.json",
    data: {
      payload: {
        externalEventId: "passage-1",
        eventType: "passage",
        direction: "entry",
        result: "allowed",
        credentialUid: "0012",
        occurredAt: new Date().toISOString(),
      },
    },
  }
  const service = new BridgeService(config(), {
    logger: { info() {}, warn() {}, error() {} },
    cloud: { event: async (event) => calls.push(["cloud", event.externalEventId]) },
    queue: {
      enqueue: async (event) => calls.push(["queue", event.externalEventId]),
      due: async () => [entry],
      acknowledge: async () => calls.push(["ack", entry.data.payload.externalEventId]),
      retry: async () => {},
      deadLetter: async () => {},
      size: async () => 0,
    },
  })
  await service.handleProviderEvent(entry.data.payload)
  assert.deepEqual(calls.map(([name]) => name), ["queue", "cloud", "ack"])
})
