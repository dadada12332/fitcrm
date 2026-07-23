import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DurableQueue } from "../src/durable-queue.mjs"

test("persists and acknowledges queued events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-queue-"))
  try {
    const queue = new DurableQueue(directory, { now: () => 1000 })
    await queue.enqueue({ externalEventId: "event-1" })
    assert.equal(await queue.size(), 1)
    const [entry] = await queue.due()
    assert.equal(entry.data.payload.externalEventId, "event-1")
    await queue.acknowledge(entry.path)
    assert.equal(await queue.size(), 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("keeps non-retryable events in a dead-letter file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-queue-"))
  try {
    const queue = new DurableQueue(directory, { now: () => 1000 })
    await queue.enqueue({ externalEventId: "event-2" })
    const [entry] = await queue.due()
    await queue.deadLetter(entry, new Error("unauthorized"))
    assert.equal(await queue.size(), 0)
    const files = await (await import("node:fs/promises")).readdir(directory)
    assert.equal(files.some((file) => file.endsWith(".dead")), true)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("refuses new events when the configured queue capacity is reached", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-queue-"))
  try {
    const queue = new DurableQueue(directory, { now: () => 1000, maxEntries: 1 })
    await queue.enqueue({ externalEventId: "event-1" })
    await assert.rejects(queue.enqueue({ externalEventId: "event-2" }), {
      code: "QUEUE_FULL",
    })
    assert.equal(await queue.size(), 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("includes retained failure files in the disk quota", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-queue-"))
  try {
    const queue = new DurableQueue(directory, {
      now: () => 1000,
      maxBytes: 300,
      maxFailureFiles: 10,
    })
    await queue.enqueue({ externalEventId: "event-1", payload: "x".repeat(40) })
    const [entry] = await queue.due()
    await queue.deadLetter(entry, new Error("unauthorized"))

    await assert.rejects(
      queue.enqueue({ externalEventId: "event-2", payload: "x".repeat(200) }),
      { code: "QUEUE_FULL" },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
