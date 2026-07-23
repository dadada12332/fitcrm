import test from "node:test"
import assert from "node:assert/strict"
import { FitCrmCloudClient } from "../src/cloud-client.mjs"

test("sends the integration key only in the protected header", async () => {
  let captured
  const client = new FitCrmCloudClient({
    baseUrl: "https://fitcrm.example",
    integrationId: "integration",
    accessKey: "top-secret",
    timeoutMs: 1_000,
  }, {
    fetchImpl: async (url, init) => {
      captured = { url, init }
      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    },
  })
  const result = await client.decision({ eventType: "access_request" })
  assert.equal(result.allowed, true)
  assert.equal(captured.init.headers["x-fitcrm-access-key"], "top-secret")
  assert.equal(captured.init.body.includes("top-secret"), false)
})

test("treats a logical cloud storage failure as retryable even on HTTP 200", async () => {
  const client = new FitCrmCloudClient({
    baseUrl: "https://fitcrm.example",
    integrationId: "integration",
    accessKey: "top-secret",
    timeoutMs: 1_000,
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      ok: false,
      error: "storage_error",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  })

  await assert.rejects(client.event({ eventType: "passage" }), (error) => {
    assert.equal(error.retryable, true)
    assert.match(error.message, /storage_error/)
    return true
  })
})
