import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAdapter } from "../src/adapters/zkteco.mjs";

const fixtures = new URL("./fixtures/zkteco/", import.meta.url);
const fixture = async (name) => JSON.parse(await readFile(new URL(name, fixtures), "utf8"));
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return body;
  },
});

function baseConfig(overrides = {}) {
  return {
    baseUrl: "https://zkbio.example.test",
    auth: {
      mode: "token",
      path: "/configured/auth/path/",
      body: { username: "bridge", password: "not-a-real-secret" },
      tokenPath: ["token"],
    },
    events: { path: "/configured/events/path/" },
    mapping: { profile: "zkbiotime-attendance" },
    pollIntervalMs: 1_000,
    ...overrides,
  };
}

test("polls a configured ZKBioTime transaction path and normalizes events", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  const calls = [];
  const delivered = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response({ token: "test-token" });
    return response(transactions);
  };
  const adapter = createAdapter(baseConfig(), {
    fetchImpl: fetch,
    setInterval: () => 123,
    clearInterval: () => {},
    now: () => new Date("2026-07-23T03:30:00.000Z"),
  });

  await adapter.start((event) => delivered.push(event));

  assert.equal(calls[0].url, "https://zkbio.example.test/configured/auth/path/");
  assert.equal(calls[1].url, "https://zkbio.example.test/configured/events/path/");
  assert.equal(calls[1].init.headers.Authorization, "Bearer test-token");
  assert.deepEqual(delivered.map(({ payload: _payload, ...event }) => event), [
    {
      externalEventId: "4101",
      occurredAt: "2026-07-23T03:14:22.000Z",
      credentialUid: "FIT-0042",
      deviceId: "ZK-TASH-01",
      direction: "entry",
      eventType: "passage",
      result: "allowed",
    },
    {
      externalEventId: "4102",
      occurredAt: "2026-07-23T03:15:08.000Z",
      credentialUid: "FIT-0043",
      deviceId: "ZK-TASH-02",
      direction: "exit",
      eventType: "passage",
      result: "allowed",
    },
  ]);
  assert.equal(delivered[0].payload.zktecoEventType, "15");
  assert.equal(delivered[0].payload.zktecoDirection, "0");
  assert.deepEqual(adapter.health(), {
    ok: true,
    state: "running",
    productProfile: "zkbiotime-attendance",
    transportSecure: true,
    lastPollAt: "2026-07-23T03:30:00.000Z",
    lastSuccessAt: "2026-07-23T03:30:00.000Z",
    lastEventAt: "2026-07-23T03:30:00.000Z",
    lastError: null,
    deliveredEvents: 2,
  });
  await adapter.stop();
});

test("supports the CVSecurity access-transaction response profile", async () => {
  const transactions = await fixture("cvsecurity-transactions.json");
  const delivered = [];
  const adapter = createAdapter(
    baseConfig({
      auth: { mode: "static-bearer", token: "licensed-api-token" },
      mapping: { profile: "zkbio-cvsecurity-access" },
    }),
    {
      fetch: async () => response(transactions),
      setInterval: () => 1,
      clearInterval: () => {},
    },
  );

  await adapter.start((event) => delivered.push(event));

  assert.equal(delivered.length, 1);
  assert.deepEqual(
    { ...delivered[0], payload: undefined },
    {
      externalEventId: "acc-7001",
      occurredAt: "2026-07-23T04:00:00.000Z",
      credentialUid: "FIT-0099",
      deviceId: "CVS-DOOR-01",
      direction: "entry",
      eventType: "passage",
      result: "unknown",
      payload: undefined,
    },
  );
  await adapter.stop();
});

test("maps CVSecurity result codes only when configured from the installed API guide", async () => {
  const transactions = await fixture("cvsecurity-transactions.json");
  const delivered = [];
  const adapter = createAdapter(
    baseConfig({
      auth: { mode: "none" },
      mapping: {
        profile: "zkbio-cvsecurity-access",
        resultMap: { "0": "allowed" },
      },
    }),
    {
      fetch: async () => response(transactions),
      setInterval: () => 1,
      clearInterval: () => {},
    },
  );

  await adapter.start((event) => delivered.push(event));

  assert.equal(delivered[0].result, "allowed");
  await adapter.stop();
});

test("fails closed when the installed release response does not match the profile", async () => {
  const invalid = await fixture("invalid-events-shape.json");
  const adapter = createAdapter(baseConfig({ auth: { mode: "none" } }), {
    fetch: async () => response(invalid),
    setInterval: () => 1,
    clearInterval: () => {},
  });

  await assert.rejects(adapter.start(() => assert.fail("must not deliver")), {
    name: "ZKTecoAdapterError",
    code: "EVENTS_SHAPE_MISMATCH",
  });
  const health = adapter.health();
  assert.equal(health.ok, false);
  assert.equal(health.state, "degraded");
  assert.equal(health.lastError.code, "EVENTS_SHAPE_MISMATCH");
  assert.equal(health.deliveredEvents, 0);

  const probe = await adapter.testConnection();
  assert.equal(probe.ok, false);
  assert.match(probe.error, /mapping\.list/);
  assert.equal(probe.diagnostic.code, "EVENTS_SHAPE_MISMATCH");
});

test("validates the whole page before delivering any event", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  transactions.data.push({ id: 4103, emp_code: "FIT-0044" });
  let delivered = 0;
  const adapter = createAdapter(baseConfig({ auth: { mode: "none" } }), {
    fetch: async () => response(transactions),
    setInterval: () => 1,
    clearInterval: () => {},
  });

  await assert.rejects(adapter.start(() => delivered++), { code: "INVALID_EVENT" });
  assert.equal(delivered, 0);
});

test("testConnection authenticates and probes without emitting events", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  let calls = 0;
  const adapter = createAdapter(baseConfig(), {
    fetch: async () => (++calls === 1 ? response({ token: "probe-token" }) : response(transactions)),
  });

  const result = await adapter.testConnection();
  assert.deepEqual({ ...result, checkedAt: undefined }, {
    ok: true,
    productProfile: "zkbiotime-attendance",
    eventCount: 2,
    checkedAt: undefined,
  });
  assert.match(result.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("reauthenticates once after an expired token", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  const calls = [];
  const adapter = createAdapter(baseConfig(), {
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) return response({ token: "expired-token" });
      if (calls.length === 2) return response({ detail: "expired" }, 401);
      if (calls.length === 3) return response({ token: "fresh-token" });
      return response(transactions);
    },
    setInterval: () => 1,
    clearInterval: () => {},
  });

  const delivered = [];
  await adapter.start((event) => delivered.push(event));

  assert.equal(calls.length, 4);
  assert.equal(delivered.length, 2);
  await adapter.stop();
});

test("deduplicates transaction ids returned by overlapping polling windows", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  let scheduled;
  const adapter = createAdapter(baseConfig({ auth: { mode: "none" } }), {
    fetchImpl: async () => response(transactions),
    setInterval: (callback) => {
      scheduled = callback;
      return 1;
    },
    clearInterval: () => {},
  });
  const delivered = [];

  await adapter.start((event) => delivered.push(event));
  await scheduled();

  assert.equal(delivered.length, 2);
  assert.equal(adapter.health().deliveredEvents, 2);
  await adapter.stop();
});

test("restores the durable polling checkpoint before the first request", async () => {
  const transactions = await fixture("zkbiotime-transactions.json");
  let requested;
  const saved = [];
  const adapter = createAdapter(baseConfig({
    auth: { mode: "none" },
    events: {
      path: "/configured/events/path/",
      sinceParam: "start_time",
    },
  }), {
    fetch: async (url) => {
      requested = new URL(url);
      return response(transactions);
    },
    loadCheckpoint: async () => ({
      lastOccurredAt: "2026-07-23T03:14:22.000Z",
      seenIds: ["4101"],
    }),
    saveCheckpoint: async (value) => saved.push(value),
    setInterval: () => 1,
    clearInterval: () => {},
  });
  const delivered = [];

  await adapter.start((event) => delivered.push(event.externalEventId));

  assert.equal(requested.searchParams.get("start_time"), "2026-07-23T03:14:22.000Z");
  assert.deepEqual(delivered, ["4102"]);
  assert.equal(saved.at(-1).lastOccurredAt, "2026-07-23T03:15:08.000Z");
  await adapter.stop();
});

test("rejects implicit plaintext HTTP and requires configured paths", () => {
  assert.throws(
    () => createAdapter(baseConfig({ baseUrl: "http://192.0.2.10" })),
    { code: "INSECURE_TRANSPORT" },
  );
  assert.throws(
    () => createAdapter(baseConfig({ events: {} })),
    { code: "INVALID_CONFIG" },
  );
});

test("allows a fully custom documented response mapping", async () => {
  const delivered = [];
  const adapter = createAdapter(
    baseConfig({
      auth: { mode: "none" },
      mapping: {
        profile: "custom",
        list: ["transactions"],
        id: ["transactionId"],
        occurredAt: ["when"],
        personId: ["employee", "code"],
        deviceId: ["reader"],
      },
    }),
    {
      fetch: async () =>
        response({
          transactions: [
            {
              transactionId: "custom-1",
              when: "2026-07-23T12:00:00Z",
              employee: { code: "7" },
              reader: "front-door",
            },
          ],
        }),
      setInterval: () => 1,
      clearInterval: () => {},
    },
  );

  await adapter.start((event) => delivered.push(event));
  assert.equal(delivered[0].credentialUid, "7");
  assert.equal(delivered[0].deviceId, "front-door");
  await adapter.stop();
});
