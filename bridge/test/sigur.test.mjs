import assert from "node:assert/strict";
import test from "node:test";

import { createAdapter } from "../src/adapters/sigur.mjs";

function jsonResponse(body, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noOpTimers() {
  let nextId = 0;
  return {
    setTimeout(callback, delay) {
      if (delay <= 10_000) return globalThis.setTimeout(callback, delay);
      return ++nextId;
    },
    clearTimeout(id) {
      globalThis.clearTimeout(id);
    },
  };
}

test("testConnection uses documented authentication and events endpoints", async () => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/api/v1/users/auth")) {
      return jsonResponse({
        token: "jwt",
        expiresAt: "2099-01-01T00:00:00Z",
      });
    }
    return jsonResponse([]);
  };

  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      username: "bridge",
      password: "secret",
      eventMap: { credentialUid: "accessObjectId" },
    },
    { fetch },
  );

  const result = await adapter.testConnection();

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "http://sigur.local:9500/api/v1/users/auth");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    username: "bridge",
    password: "secret",
  });
  assert.match(calls[1].url, /\/api\/v1\/events\?/);
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer jwt");
});

test("start polls documented events endpoint, maps and advances lastId", async () => {
  const calls = [];
  const scheduled = [];
  const fetch = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    return jsonResponse([
      {
        id: 12,
        type: 6,
        timestamp: "2026-07-23T10:00:00+05:00",
        accessPointId: 4,
        accessObjectId: 9,
        direction: "IN",
      },
      {
        id: 11,
        type: 6,
        timestamp: "2026-07-23T09:59:00+05:00",
        accessPointId: 4,
        accessObjectId: 8,
        direction: "OUT",
      },
    ]);
  };
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      token: "managed-jwt",
      replayExisting: true,
      initialCursor: 10,
      pollIntervalMs: 1_000,
      eventMap: { credentialUid: "accessObjectId" },
    },
    {
      fetch,
      setTimeout(callback, delay) {
        if (delay === 1_000) scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeout() {},
      now: () => new Date("2026-07-23T05:00:00.000Z"),
    },
  );
  const received = [];

  await adapter.start((event) => received.push(event));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, "/api/v1/events");
  assert.equal(calls[0].searchParams.get("lastId"), "10");
  assert.deepEqual(
    received.map((event) => event.externalEventId),
    ["11", "12"],
  );
  assert.deepEqual(received[0], {
    externalEventId: "11",
    eventType: "unknown",
    direction: "exit",
    result: "unknown",
    credentialUid: "8",
    occurredAt: "2026-07-23T04:59:00.000Z",
    deviceId: "4",
  });
  assert.equal(adapter.health().cursor, 12);
  assert.equal(adapter.health().eventsReceived, 2);

  await adapter.stop();
  assert.equal(adapter.health().running, false);
});

test("default startup establishes a cursor without replaying historical events", async () => {
  const fetch = async () =>
    jsonResponse([
      {
        id: 55,
        type: 6,
        timestamp: "2026-07-23T10:00:00+05:00",
      },
    ]);
  const timers = noOpTimers();
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      token: "managed-jwt",
      pollIntervalMs: 60_000,
      eventMap: { credentialUid: "accessObjectId" },
    },
    { fetch, ...timers },
  );
  const received = [];

  await adapter.start((event) => received.push(event));

  assert.deepEqual(received, []);
  assert.equal(adapter.health().cursor, 55);
  await adapter.stop();
});

test("restores the durable cursor and checkpoints only after event delivery", async () => {
  const saved = [];
  let requested;
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      token: "managed-jwt",
      eventMap: { credentialUid: "accessObjectId" },
    },
    {
      fetch: async (url) => {
        requested = new URL(url);
        return jsonResponse([{
          id: 55,
          timestamp: "2026-07-23T10:00:00+05:00",
          accessObjectId: 10,
        }]);
      },
      loadCheckpoint: async () => ({ cursor: 54 }),
      saveCheckpoint: async (value) => saved.push(value),
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  const delivered = [];

  await adapter.start((event) => delivered.push(event.externalEventId));

  assert.equal(requested.searchParams.get("lastId"), "54");
  assert.deepEqual(delivered, ["55"]);
  assert.deepEqual(saved, [{ cursor: 55 }]);
  await adapter.stop();
});

test("supports an explicit event field mapping without retaining raw payload", async () => {
  const fetch = async () =>
    jsonResponse([
      {
        id: 7,
        timestamp: "2026-07-23T10:00:00+05:00",
        data: { member: "abc" },
        direction: "IN",
      },
    ]);
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      token: "managed-jwt",
      replayExisting: true,
      eventMap: {
        externalEventId: "id",
        credentialUid: "data.member",
        direction: "direction",
      },
    },
    {
      fetch,
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  const received = [];

  await adapter.start((event) => received.push(event));

  assert.deepEqual(received, [
    {
      externalEventId: "7",
      eventType: "unknown",
      direction: "entry",
      result: "unknown",
      credentialUid: "abc",
      occurredAt: "2026-07-23T05:00:00.000Z",
    },
  ]);
  assert.equal("payload" in received[0], false);
  await adapter.stop();
});

test("marks a mapped confirmed passage as allowed without requiring a redundant result field", async () => {
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      token: "managed-jwt",
      replayExisting: true,
      eventMap: { credentialUid: "accessObjectId" },
      eventTypes: { "6": "passage" },
    },
    {
      fetch: async () => jsonResponse([{
        id: 77,
        type: 6,
        timestamp: "2026-07-23T10:00:00+05:00",
        accessObjectId: 9,
        direction: "IN",
      }]),
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  const received = [];

  await adapter.start((event) => received.push(event));

  assert.equal(received[0].eventType, "passage");
  assert.equal(received[0].result, "allowed");
  await adapter.stop();
});

test("reports missing configuration and gated web delegation capability", async () => {
  const adapter = createAdapter();

  const health = adapter.health();
  const connection = await adapter.testConnection();

  assert.equal(health.status, "misconfigured");
  assert.equal(health.capabilities.restApi.supported, true);
  assert.equal(health.capabilities.restApi.configured, false);
  assert.equal(health.capabilities.webDelegation.supported, false);
  assert.match(health.capabilities.webDelegation.reason, /does not publish/i);
  assert.equal(connection.ok, false);
  assert.match(connection.error, /baseUrl/);
});

test("reauthenticates once when an events request returns 401", async () => {
  let authenticationCount = 0;
  let eventCount = 0;
  const fetch = async (url) => {
    if (String(url).includes("/users/auth")) {
      authenticationCount += 1;
      return jsonResponse({
        token: `jwt-${authenticationCount}`,
        expiresAt: "2099-01-01T00:00:00Z",
      });
    }
    eventCount += 1;
    return eventCount === 1 ? jsonResponse({}, 401) : jsonResponse([]);
  };
  const adapter = createAdapter(
    {
      baseUrl: "http://sigur.local:9500",
      username: "bridge",
      password: "secret",
      eventMap: { credentialUid: "accessObjectId" },
    },
    { fetch },
  );

  const result = await adapter.testConnection();

  assert.equal(result.ok, true);
  assert.equal(authenticationCount, 2);
  assert.equal(eventCount, 2);
});
