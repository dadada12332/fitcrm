import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CheckpointStore } from "../src/checkpoint-store.mjs"

test("persists and restores an adapter checkpoint atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitcrm-checkpoint-"))
  const store = new CheckpointStore(directory)

  assert.equal(await store.load("sigur"), null)
  await store.save("sigur", { cursor: 42 })
  assert.deepEqual(await store.load("sigur"), { cursor: 42 })
})
