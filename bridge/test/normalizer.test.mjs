import test from "node:test"
import assert from "node:assert/strict"
import { normalizeEvent } from "../src/normalizer.mjs"

test("keeps opaque credential values and maps reader direction", () => {
  const event = normalizeEvent({
    eventType: "passage",
    result: "allowed",
    credentialUid: "0012Ab",
    occurredAt: "2026-07-23T12:00:00+05:00",
    deviceId: "reader-in",
  }, "mock", { entryReaders: ["reader-in"] })
  assert.equal(event.credentialUid, "0012Ab")
  assert.equal(event.direction, "entry")
  assert.match(event.externalEventId, /^bridge:[a-f0-9]{64}$/)
})

test("fails closed on missing credential", () => {
  assert.throws(() => normalizeEvent({
    eventType: "passage",
    result: "allowed",
  }, "mock"), /credentialUid/)
})
