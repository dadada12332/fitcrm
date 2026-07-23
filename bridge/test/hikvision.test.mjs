import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import {
  HikvisionEventDecoder,
  createAdapter,
  parseDigestChallenge,
  signHikCentralRequest,
} from "../src/adapters/hikvision.mjs";

const fixtureUrl = new URL("./fixtures/hikvision/", import.meta.url);
const xml = await readFile(new URL("access-event.xml", fixtureUrl), "utf8");
const json = await readFile(new URL("access-event.json", fixtureUrl), "utf8");

test("parses quoted Digest challenges and builds a valid authenticated request", async () => {
  const challenge = parseDigestChallenge(
    'Digest realm="IP Camera", nonce="abc,123", qop="auth,auth-int", opaque="xyz", algorithm=MD5',
  );
  assert.equal(challenge.realm, "IP Camera");
  assert.equal(challenge.nonce, "abc,123");
  assert.equal(challenge.qop, "auth,auth-int");

  const calls = [];
  const adapter = createAdapter(
    {
      mode: "isapi",
      baseUrl: "http://camera.local",
      username: "operator",
      password: "secret",
    },
    {
      randomBytes: () => Buffer.from("00112233445566778899aabbccddeeff", "hex"),
      fetch: async (_url, init) => {
        calls.push(init);
        if (calls.length === 1) {
          return new Response("", {
            status: 401,
            headers: {
              "WWW-Authenticate":
                'Digest realm="IP Camera", nonce="abcdef", qop="auth", algorithm=MD5',
            },
          });
        }
        return new Response("<DeviceInfo/>", {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      },
    },
  );
  const result = await adapter.testConnection();
  assert.equal(result.ok, true);
  assert.match(calls[1].headers.get("Authorization"), /^Digest /);
  assert.match(calls[1].headers.get("Authorization"), /qop=auth/);
  assert.doesNotMatch(calls[1].headers.get("Authorization"), /secret/);
});

test("decodes chunked multipart ISAPI XML and JSON events", () => {
  const boundary = "MIME_boundary";
  const wire =
    `--${boundary}\r\nContent-Type: application/xml\r\n\r\n${xml}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
    `--${boundary}--\r\n`;
  const decoder = new HikvisionEventDecoder(`multipart/mixed; boundary="${boundary}"`);
  const midpoint = Math.floor(wire.length / 2);
  const events = [
    ...decoder.push(Buffer.from(wire.slice(0, midpoint))),
    ...decoder.push(Buffer.from(wire.slice(midpoint)), true),
  ];
  assert.equal(events.length, 2);
  assert.match(events[0], /AccessControllerEvent/);
  assert.equal(events[1].EventNotificationAlert.cardNo, "112233");
});

test("normalizes ISAPI access events delivered by the stream", async () => {
  const boundary = "events";
  const body = `--${boundary}\r\nContent-Type: application/xml\r\n\r\n${xml}\r\n--${boundary}--\r\n`;
  let streamRequest = 0;
  const adapter = createAdapter(
    {
      mode: "isapi",
      baseUrl: "http://camera.local",
      username: "operator",
      password: "secret",
      retryMinMs: 1,
      retryMaxMs: 1,
    },
    {
      fetch: async (_url, init) => {
        streamRequest += 1;
        if (streamRequest > 1) {
          return new Promise((_, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => reject(init.signal.reason ?? new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        }
        return new Response(body, {
          headers: { "Content-Type": `multipart/mixed; boundary=${boundary}` },
        });
      },
      sleep: async () => {},
      now: () => Date.parse("2026-07-23T06:00:00.000Z"),
    },
  );
  const received = [];
  await adapter.start(async (event) => received.push(event));
  await new Promise((resolve) => setImmediate(resolve));
  await adapter.stop();
  assert.equal(received.length, 1);
  assert.equal(received[0].eventType, "passage");
  assert.equal(received[0].credentialUid, "998877");
  assert.equal(received[0].payload.cardNo, "998877");
  assert.equal(received[0].doorId, "1");
});

test("HikCentral callback mode ingests and deduplicates pushed events", async () => {
  const adapter = createAdapter({
    mode: "hikcentral",
    baseUrl: "https://hcp.local",
    appKey: "key",
    appSecret: "secret",
  }, {
    fetch: async () => new Response(JSON.stringify({ code: "0" }), {
      headers: { "content-type": "application/json" },
    }),
  })
  const received = []
  await adapter.start(async (event) => received.push(event))
  const payload = {
    data: {
      list: [{
        eventId: "callback-1",
        eventType: "cardSwiping",
        eventTime: "2026-07-23T12:00:00+05:00",
        cardNo: "001122",
      }],
    },
  }
  assert.equal(await adapter.ingest(payload, async (event) => received.push(event)), 1)
  assert.equal(await adapter.ingest(payload, async (event) => received.push(event)), 0)
  assert.equal(received[0].credentialUid, "001122")
  await adapter.stop()
})

test("HikCentral signing follows the documented canonical HMAC-SHA256 form", () => {
  const result = signHikCentralRequest({
    appKey: "app-key",
    appSecret: "app-secret",
    endpoint: "/artemis/api/example?b=2&a=1",
    body: '{"pageNo":1}',
    timestamp: 1_721_700_000_000,
    nonce: "00000000-0000-4000-8000-000000000000",
  });
  assert.equal(
    result.headers["X-Ca-Signature-Headers"],
    "x-ca-key,x-ca-nonce,x-ca-timestamp",
  );
  assert.match(result.headers["Content-MD5"], /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(result.stringToSign.endsWith("/artemis/api/example?a=1&b=2"));
  assert.equal(
    result.headers["X-Ca-Signature"],
    result.signature,
  );
});

test("HikCentral rejects unsafe configuration and signs configurable polling", async () => {
  assert.throws(
    () =>
      createAdapter({
        mode: "hikcentral",
        baseUrl: "https://hcp.local",
        appKey: "key",
        appSecret: "secret",
        pollEndpoint: "https://attacker.invalid/events",
      }),
    /must start with \/artemis\/api\//,
  );
  assert.throws(
    () =>
      createAdapter({
        mode: "hikcentral",
        baseUrl: "http://hcp.local",
        appKey: "key",
        appSecret: "secret",
      }),
    /requires HTTPS/,
  );
  assert.throws(
    () =>
      createAdapter({
        mode: "hikcentral",
        baseUrl: "https://hcp.local",
        appKey: "key",
        appSecret: "secret",
        pollEndpoint: "/artemis/api/%2e%2e/%2e%2e/admin",
      }),
    /must start with \/artemis\/api\//,
  );

  const requests = [];
  const adapter = createAdapter(
    {
      mode: "hikcentral",
      baseUrl: "https://hcp.local",
      appKey: "key",
      appSecret: "secret",
      pollEndpoint: "/artemis/api/acs/v1/door/events",
      pollBody: { pageNo: 1, pageSize: 10 },
      pollIntervalMs: 1,
    },
    {
      now: () => 1_721_700_000_000,
      randomUUID: () => "00000000-0000-4000-8000-000000000000",
      sleep: (_ms, signal) =>
        new Promise((resolve) =>
          signal?.addEventListener("abort", resolve, { once: true }),
        ),
      fetch: async (url, init) => {
        requests.push({ url, init });
        return new Response(
          JSON.stringify({
            code: "0",
            data: {
              list: [
                {
                  eventId: "event-1",
                  eventType: "cardSwiping",
                  eventTime: "2026-07-23T12:00:00+05:00",
                  personId: "member-99",
                },
              ],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  const events = [];
  await adapter.start(async (event) => {
    events.push(event);
  });
  await new Promise((resolve) => setImmediate(resolve));
  await adapter.stop();
  assert.equal(events[0].externalEventId, "event-1");
  assert.equal(requests[0].init.headers["X-Ca-Key"], "key");
  assert.match(requests[0].init.headers["X-Ca-Signature"], /^[A-Za-z0-9+/]+={0,2}$/);
});

let server;
let baseUrl;
before(async () => {
  server = createServer((request, response) => {
    if (request.url === "/ISAPI/System/deviceInfo") {
      response.writeHead(200, { "Content-Type": "application/xml" });
      response.end("<DeviceInfo/>");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("ISAPI testConnection also accepts devices with authentication disabled", async () => {
  const adapter = createAdapter({
    mode: "isapi",
    baseUrl,
    username: "operator",
    password: "secret",
  });
  assert.equal((await adapter.testConnection()).status, 200);
});
