import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  randomUUID as nodeRandomUUID,
} from "node:crypto";

const DEFAULT_ISAPI_STREAM = "/ISAPI/Event/notification/alertStream";
const DEFAULT_ISAPI_HEALTH = "/ISAPI/System/deviceInfo";
const DEFAULT_HIKCENTRAL_HEALTH = "/artemis/api/common/v1/version";
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Hikvision config requires ${name}`);
  }
  return value.trim();
}

function positiveNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive number`);
  }
  return value;
}

function validateRelativeEndpoint(value, fallback, prefix) {
  const endpoint = value ?? fallback;
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(String(endpoint).split(/[?#]/, 1)[0]);
  } catch {
    throw new TypeError("Hikvision endpoint contains invalid percent encoding");
  }
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith(prefix) ||
    endpoint.startsWith("//") ||
    endpoint.includes("#") ||
    endpoint.includes("\\") ||
    decodedPath.split("/").includes("..") ||
    /[\r\n]/.test(endpoint)
  ) {
    throw new TypeError(`Hikvision endpoint must start with ${prefix}`);
  }
  return endpoint;
}

function normalizeConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Hikvision config must be an object");
  }

  const mode = input.mode ?? "isapi";
  if (mode !== "isapi" && mode !== "hikcentral") {
    throw new TypeError("Hikvision mode must be isapi or hikcentral");
  }

  const baseUrl = new URL(requiredString(input.baseUrl, "baseUrl"));
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new TypeError("Hikvision baseUrl must use HTTP or HTTPS");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new TypeError("Hikvision baseUrl must not contain credentials, query, or fragment");
  }
  if (baseUrl.pathname !== "/" && baseUrl.pathname !== "") {
    throw new TypeError("Hikvision baseUrl must be an origin without a path");
  }
  if (mode === "hikcentral" && baseUrl.protocol !== "https:" && input.allowInsecureHttp !== true) {
    throw new TypeError("HikCentral requires HTTPS unless allowInsecureHttp is explicitly enabled");
  }

  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");
  const common = {
    mode,
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    requestTimeoutMs: positiveNumber(input.requestTimeoutMs, 10_000, "requestTimeoutMs"),
    retryMinMs: positiveNumber(input.retryMinMs, 1_000, "retryMinMs"),
    retryMaxMs: positiveNumber(input.retryMaxMs, 30_000, "retryMaxMs"),
    deviceId: typeof input.deviceId === "string" ? input.deviceId : null,
    accessRequestEventTypes: stringArray(input.accessRequestEventTypes, "accessRequestEventTypes"),
    deniedEventTypes: stringArray(input.deniedEventTypes, "deniedEventTypes"),
    passageEventTypes: stringArray(input.passageEventTypes, "passageEventTypes"),
    includeInactiveEvents: input.includeInactiveEvents === true,
    includeRaw: input.includeRaw === true,
  };

  if (common.retryMaxMs < common.retryMinMs) {
    throw new TypeError("retryMaxMs must be greater than or equal to retryMinMs");
  }

  if (mode === "isapi") {
    return {
      ...common,
      username: requiredString(input.username, "username"),
      password: requiredString(input.password, "password"),
      streamEndpoint: validateRelativeEndpoint(
        input.streamEndpoint,
        DEFAULT_ISAPI_STREAM,
        "/ISAPI/",
      ),
      healthEndpoint: validateRelativeEndpoint(
        input.healthEndpoint,
        DEFAULT_ISAPI_HEALTH,
        "/ISAPI/",
      ),
    };
  }

  const settings = {
    ...common,
    appKey: requiredString(input.appKey, "appKey"),
    appSecret: requiredString(input.appSecret, "appSecret"),
    healthEndpoint: validateRelativeEndpoint(
      input.healthEndpoint,
      DEFAULT_HIKCENTRAL_HEALTH,
      "/artemis/api/",
    ),
    pollEndpoint:
      input.pollEndpoint === undefined
        ? null
        : validateRelativeEndpoint(input.pollEndpoint, null, "/artemis/api/"),
    pollMethod: String(input.pollMethod ?? "POST").toUpperCase(),
    pollBody: input.pollBody ?? {},
    pollIntervalMs: positiveNumber(input.pollIntervalMs, 5_000, "pollIntervalMs"),
  };
  if (settings.pollMethod !== "POST") {
    throw new TypeError("HikCentral pollMethod must be POST");
  }
  return settings;
}

function stringArray(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === "")) {
    throw new TypeError(`${name} must be an array of non-empty strings`);
  }
  return [...value];
}

function hashHex(algorithm, value) {
  const nodeAlgorithm = algorithm.toLowerCase().replace("-sess", "").replace("-", "");
  return createHash(nodeAlgorithm).update(value, "utf8").digest("hex");
}

function splitAuthParams(value) {
  const result = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      current += char;
      escaped = true;
    } else if (char === '"') {
      current += char;
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

export function parseDigestChallenge(header) {
  if (typeof header !== "string" || !/^Digest\s/i.test(header)) {
    throw new Error("Device did not return a Digest authentication challenge");
  }
  const params = {};
  for (const item of splitAuthParams(header.replace(/^Digest\s+/i, ""))) {
    const match = /^\s*([^=\s]+)\s*=\s*(?:"((?:\\.|[^"])*)"|([^,\s]*))\s*$/.exec(item);
    if (match) params[match[1].toLowerCase()] = (match[2] ?? match[3]).replace(/\\"/g, '"');
  }
  if (!params.realm || !params.nonce) throw new Error("Invalid Digest authentication challenge");
  return params;
}

function digestAuthorization({ challenge, method, uri, username, password, cnonce }) {
  const algorithm = (challenge.algorithm ?? "MD5").toUpperCase();
  if (!["MD5", "MD5-SESS", "SHA-256", "SHA-256-SESS"].includes(algorithm)) {
    throw new Error(`Unsupported Digest algorithm: ${algorithm}`);
  }
  const qops = (challenge.qop ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const qop = qops.includes("auth") ? "auth" : null;
  if (qops.length > 0 && !qop) throw new Error("Device Digest challenge does not support qop=auth");

  let ha1 = hashHex(algorithm, `${username}:${challenge.realm}:${password}`);
  if (algorithm.endsWith("-SESS")) {
    ha1 = hashHex(algorithm, `${ha1}:${challenge.nonce}:${cnonce}`);
  }
  const ha2 = hashHex(algorithm, `${method}:${uri}`);
  const nc = "00000001";
  const response = qop
    ? hashHex(algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : hashHex(algorithm, `${ha1}:${challenge.nonce}:${ha2}`);
  const quote = (value) => `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const fields = [
    `username=${quote(username)}`,
    `realm=${quote(challenge.realm)}`,
    `nonce=${quote(challenge.nonce)}`,
    `uri=${quote(uri)}`,
    `response=${quote(response)}`,
    `algorithm=${algorithm}`,
  ];
  if (challenge.opaque) fields.push(`opaque=${quote(challenge.opaque)}`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce=${quote(cnonce)}`);
  return `Digest ${fields.join(", ")}`;
}

async function digestFetch(fetchImpl, url, init, credentials, randomBytes) {
  const first = await fetchImpl(url, init);
  if (first.status !== 401) return first;
  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  await first.body?.cancel?.().catch(() => {});
  const parsedUrl = new URL(url);
  const uri = `${parsedUrl.pathname}${parsedUrl.search}`;
  const authorization = digestAuthorization({
    challenge,
    method: init.method ?? "GET",
    uri,
    ...credentials,
    cnonce: randomBytes(16).toString("hex"),
  });
  const headers = new Headers(init.headers);
  headers.set("Authorization", authorization);
  return fetchImpl(url, { ...init, headers });
}

function canonicalArtemisResource(endpoint) {
  const url = new URL(endpoint, "https://hikcentral.invalid");
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return url.pathname;
  const query = entries
    .map(([key, value]) => (value === "" ? key : `${key}=${value}`))
    .join("&");
  return `${url.pathname}?${query}`;
}

export function signHikCentralRequest({
  appKey,
  appSecret,
  method = "POST",
  endpoint,
  body = "",
  timestamp = Date.now(),
  nonce = nodeRandomUUID(),
}) {
  const accept = "*/*";
  const contentType = body === "" ? "" : "application/json";
  const contentMd5 =
    body === "" ? "" : createHash("md5").update(body, "utf8").digest("base64");
  const signedHeaders = {
    "x-ca-key": appKey,
    "x-ca-nonce": nonce,
    "x-ca-timestamp": String(timestamp),
  };
  const signedHeaderNames = Object.keys(signedHeaders).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${signedHeaders[name]}\n`)
    .join("");
  const stringToSign = [
    method.toUpperCase(),
    accept,
    contentMd5,
    contentType,
    "",
    `${canonicalHeaders}${canonicalArtemisResource(endpoint)}`,
  ].join("\n");
  const signature = createHmac("sha256", appSecret)
    .update(stringToSign, "utf8")
    .digest("base64");
  const headers = {
    Accept: accept,
    "X-Ca-Key": appKey,
    "X-Ca-Nonce": nonce,
    "X-Ca-Timestamp": String(timestamp),
    "X-Ca-Signature-Headers": signedHeaderNames.join(","),
    "X-Ca-Signature": signature,
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
    headers["Content-MD5"] = contentMd5;
  }
  return { headers, stringToSign, signature };
}

function decodeXmlEntities(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlValue(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<(?:[\\w-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escaped}>`, "i").exec(xml);
  return match ? decodeXmlEntities(match[1].trim().replace(/<[^>]+>/g, "")) : null;
}

function deepValue(input, names, seen = new Set()) {
  if (!input || typeof input !== "object" || seen.has(input)) return null;
  seen.add(input);
  for (const name of names) {
    if (input[name] !== undefined && input[name] !== null && input[name] !== "") return input[name];
  }
  for (const value of Object.values(input)) {
    const found = deepValue(value, names, seen);
    if (found !== null) return found;
  }
  return null;
}

function normalizeOne(payload, config, now, mapping = {}) {
  const isXml = typeof payload === "string";
  const root =
    !isXml && payload?.EventNotificationAlert && typeof payload.EventNotificationAlert === "object"
      ? payload.EventNotificationAlert
      : payload;
  const get = (...names) =>
    isXml
      ? names.map((name) => xmlValue(payload, name)).find((value) => value !== null) ?? null
      : deepValue(root, names);
  const vendorType = get("eventType", "eventTypeName", "type") ?? "unknown";
  const vendorSubType = get("subEventType", "minor", "eventCode");
  const configuredAccessRequests = new Set(config.accessRequestEventTypes ?? []);
  const configuredDenied = new Set(config.deniedEventTypes ?? []);
  const configuredPassage = new Set(config.passageEventTypes ?? []);
  const classificationKey = String(vendorSubType ?? vendorType);
  const resultValue = String(get("eventState", "status", "eventStatus") ?? "").toLowerCase();
  const denied =
    configuredDenied.has(classificationKey) ||
    /denied|invalid|failed|failure|forbidden|reject/i.test(classificationKey) ||
    /denied|invalid|failed|failure|forbidden|reject/i.test(resultValue);
  const coreEventType = configuredAccessRequests.has(classificationKey)
    ? "access_request"
    : denied
      ? "denied"
      : configuredPassage.has(classificationKey) ||
          /accesscontrollerevent|cardswiping|door|passage/i.test(String(vendorType))
        ? "passage"
        : "unknown";
  const occurredValue = get("dateTime", "happenTime", "eventTime", "occurredAt");
  const occurredDate = occurredValue ? new Date(String(occurredValue)) : new Date(now());
  const occurredAt = Number.isNaN(occurredDate.getTime())
    ? new Date(now()).toISOString()
    : occurredDate.toISOString();
  const deviceId =
    config.deviceId ??
    get("deviceID", "deviceId", "deviceIndexCode", "srcIndex", "ipAddress") ??
    undefined;
  const doorId = get("doorNo", "doorId", "channelID", "channelId") ?? undefined;
  const readerId = get("cardReaderNo", "readerIndexCode", "readerId") ?? undefined;
  const credentialUid =
    get(
      "cardNo",
      "employeeNoString",
      "employeeNo",
      "personId",
      "personCode",
      "credentialUid",
    ) ?? undefined;
  const vendorState = get("eventState", "status", "eventStatus");
  const externalEventId =
    get("eventId") ??
    get("eventID") ??
    get("UUID") ??
    `${deviceId ?? "hikvision"}:${doorId ?? ""}:${classificationKey}:${occurredAt}:${credentialUid ?? ""}:${get("activePostCount", "serialNo") ?? ""}`;
  const directionId = readerId ?? deviceId;
  const direction =
    directionId && mapping.entryReaders?.includes(String(directionId))
      ? "entry"
      : directionId && mapping.exitReaders?.includes(String(directionId))
        ? "exit"
        : "unknown";

  const normalized = {
    externalEventId: String(externalEventId),
    eventType: coreEventType,
    direction,
    result: denied ? "denied" : coreEventType === "passage" ? "allowed" : "unknown",
    credentialUid: credentialUid === undefined ? undefined : String(credentialUid),
    occurredAt,
    deviceId: deviceId === undefined ? undefined : String(deviceId),
    doorId: doorId === undefined ? undefined : String(doorId),
    accessRequestId:
      coreEventType === "access_request" ? String(externalEventId) : undefined,
    payload: {
      transport: config.mode,
      vendorEventType: String(vendorType),
      vendorSubType: vendorSubType === null ? undefined : String(vendorSubType),
      vendorState: vendorState === null ? undefined : String(vendorState),
      readerId: readerId === undefined ? undefined : String(readerId),
      verifyMode: get("currentVerifyMode", "verifyMode") ?? undefined,
      cardNo: get("cardNo") ?? undefined,
      description: get("eventDescription", "eventTypeName") ?? undefined,
    },
  };
  if (config.includeRaw) normalized.payload.raw = payload;
  return normalized;
}

function payloadsFromHikCentral(body) {
  if (Array.isArray(body)) return body;
  const candidates = [
    body?.data?.list,
    body?.data?.events,
    body?.data,
    body?.events,
    body?.list,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return body && typeof body === "object" ? [body] : [];
}

function parseContentType(value) {
  const boundary = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(value ?? "");
  return boundary ? boundary[1] ?? boundary[2] : null;
}

function extractJsonObjects(text) {
  const values = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let consumed = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start < 0) {
      if (char === "{" || char === "[") {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = quoted;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "{" || char === "[")) {
      depth += 1;
    } else if (!quoted && (char === "}" || char === "]")) {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, index + 1);
        try {
          values.push(JSON.parse(candidate));
          consumed = index + 1;
        } catch {
          // Leave malformed vendor payload out of the event pipeline.
        }
        start = -1;
      }
    }
  }
  return { values, rest: start >= 0 ? text.slice(start) : text.slice(consumed) };
}

export class HikvisionEventDecoder {
  constructor(contentType = "") {
    this.boundary = parseContentType(contentType);
    this.buffer = Buffer.alloc(0);
  }

  push(chunk, final = false) {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    if (this.buffer.length > MAX_BUFFER_BYTES) {
      throw new Error("Hikvision event stream frame exceeded 8 MiB");
    }
    return this.boundary ? this.#multipart(final) : this.#plain(final);
  }

  #multipart(final) {
    const marker = Buffer.from(`--${this.boundary}`);
    const frames = [];
    while (true) {
      const first = this.buffer.indexOf(marker);
      if (first < 0) {
        if (final) this.buffer = Buffer.alloc(0);
        break;
      }
      if (first > 0) this.buffer = this.buffer.subarray(first);
      const next = this.buffer.indexOf(marker, marker.length);
      if (next < 0 && !final) break;
      const end = next < 0 ? this.buffer.length : next;
      const part = this.buffer.subarray(marker.length, end);
      this.buffer = next < 0 ? Buffer.alloc(0) : this.buffer.subarray(next);
      const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEnd < 0) continue;
      const headers = part.subarray(0, headerEnd).toString("latin1").toLowerCase();
      const body = part
        .subarray(headerEnd + 4)
        .toString("utf8")
        .replace(/\r\n$/, "")
        .trim();
      if (!body || (!headers.includes("json") && !headers.includes("xml") && !body.startsWith("{") && !body.startsWith("<"))) {
        continue;
      }
      frames.push(...this.#decodeText(body));
    }
    return frames;
  }

  #plain(final) {
    const text = this.buffer.toString("utf8");
    const frames = [];
    const xmlPattern = /<(?:[\w-]+:)?EventNotificationAlert\b[\s\S]*?<\/(?:[\w-]+:)?EventNotificationAlert>/gi;
    let match;
    let lastXmlEnd = 0;
    while ((match = xmlPattern.exec(text))) {
      frames.push(match[0]);
      lastXmlEnd = xmlPattern.lastIndex;
    }
    const jsonResult = extractJsonObjects(text.slice(lastXmlEnd));
    frames.push(...jsonResult.values.flatMap((value) => payloadsFromHikCentral(value)));
    const rest = jsonResult.rest;
    this.buffer = final ? Buffer.alloc(0) : Buffer.from(rest.slice(-MAX_BUFFER_BYTES), "utf8");
    return frames;
  }

  #decodeText(text) {
    if (text.startsWith("<")) return [text];
    try {
      return payloadsFromHikCentral(JSON.parse(text));
    } catch {
      return [];
    }
  }
}

function responseError(response, context) {
  return new Error(`${context} failed with HTTP ${response.status}`);
}

export function createAdapter(configInput, deps = {}) {
  const config = normalizeConfig(configInput);
  const fetchImpl = deps.fetchImpl ?? deps.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  const now = deps.now ?? Date.now;
  const randomBytes = deps.randomBytes ?? nodeRandomBytes;
  const randomUUID = deps.randomUUID ?? nodeRandomUUID;
  const logger = deps.logger ?? {};
  const sleep =
    deps.sleep ??
    ((ms, signal) =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      }));

  let controller = null;
  let loopPromise = null;
  let state = "idle";
  let lastError = null;
  let lastEventAt = null;
  let lastConnectedAt = null;
  let consecutiveFailures = 0;
  let eventsReceived = 0;
  let eventsDropped = 0;
  const seenEventIds = new Set();
  const seenEventOrder = [];

  async function timedFetch(url, init, timeoutMs = config.requestTimeoutMs) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new Error("Hikvision request timed out")), timeoutMs);
    const abort = () => timeoutController.abort(init.signal?.reason);
    init.signal?.addEventListener("abort", abort, { once: true });
    try {
      return await fetchImpl(url, { ...init, signal: timeoutController.signal });
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abort);
    }
  }

  async function isapiRequest(endpoint, { signal, streaming = false } = {}) {
    const url = new URL(endpoint, `${config.baseUrl}/`).toString();
    const init = {
      method: "GET",
      headers: { Accept: streaming ? "multipart/mixed, application/xml, application/json" : "application/xml, application/json" },
      signal,
    };
    const request = (target, requestInit) =>
      timedFetch(target, requestInit, config.requestTimeoutMs);
    return digestFetch(request, url, init, config, randomBytes);
  }

  async function hikcentralRequest(endpoint, { signal, body = {}, method = "POST" } = {}) {
    validateRelativeEndpoint(endpoint, null, "/artemis/api/");
    const serialized = body === undefined || body === null ? "" : JSON.stringify(body);
    const signed = signHikCentralRequest({
      appKey: config.appKey,
      appSecret: config.appSecret,
      method,
      endpoint,
      body: serialized,
      timestamp: now(),
      nonce: randomUUID(),
    });
    return timedFetch(
      new URL(endpoint, `${config.baseUrl}/`).toString(),
      { method, headers: signed.headers, body: serialized || undefined, signal },
      config.requestTimeoutMs,
    );
  }

  async function testConnection() {
    try {
      const response =
        config.mode === "isapi"
          ? await isapiRequest(config.healthEndpoint)
          : await hikcentralRequest(config.healthEndpoint, { body: {} });
      if (!response.ok) throw responseError(response, "Hikvision connection test");
      if (config.mode === "hikcentral") {
        const payload = await response.json().catch(() => {
          throw new Error("HikCentral connection test returned invalid JSON");
        });
        if (payload?.code !== undefined && ![0, "0"].includes(payload.code)) {
          throw new Error(`HikCentral connection test returned API code ${String(payload.code)}`);
        }
      }
      return {
        ok: true,
        provider: "hikvision",
        mode: config.mode,
        status: response.status,
        contentType: response.headers.get("content-type"),
        capabilities: {
          events: config.mode === "isapi" ? "stream" : config.pollEndpoint ? "poll" : "callback",
          decision: false,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        provider: "hikvision",
        mode: config.mode,
        error: lastError,
      };
    }
  }

  async function emit(payload, onEvent, { deduplicate = false } = {}) {
    const event = normalizeOne(payload, config, now, deps.mapping);
    if (
      !config.includeInactiveEvents &&
      event.payload.vendorState?.toLowerCase() === "inactive"
    ) {
      eventsDropped += 1;
      return;
    }
    if (!event.credentialUid) {
      eventsDropped += 1;
      logger.debug?.("Ignoring non-access Hikvision event without a credential", {
        vendorEventType: event.payload.vendorEventType,
      });
      return;
    }
    if (deduplicate && seenEventIds.has(event.externalEventId)) return;
    await onEvent(event);
    if (deduplicate) {
      seenEventIds.add(event.externalEventId);
      seenEventOrder.push(event.externalEventId);
      if (seenEventOrder.length > 10_000) {
        seenEventIds.delete(seenEventOrder.shift());
      }
    }
    eventsReceived += 1;
    lastEventAt = new Date(now()).toISOString();
  }

  async function runIsapi(onEvent, signal) {
    const response = await isapiRequest(config.streamEndpoint, { signal, streaming: true });
    if (!response.ok) throw responseError(response, "Hikvision ISAPI event stream");
    if (!response.body) throw new Error("Hikvision ISAPI event stream returned no body");
    lastConnectedAt = new Date(now()).toISOString();
    consecutiveFailures = 0;
    const decoder = new HikvisionEventDecoder(response.headers.get("content-type") ?? "");
    for await (const chunk of response.body) {
      if (signal.aborted) return;
      for (const payload of decoder.push(chunk)) {
        await emit(payload, onEvent);
      }
    }
    for (const payload of decoder.push(Buffer.alloc(0), true)) {
      await emit(payload, onEvent);
    }
    if (!signal.aborted) throw new Error("Hikvision ISAPI event stream ended");
  }

  async function runHikcentral(onEvent, signal) {
    if (!config.pollEndpoint) {
      throw new Error("HikCentral start requires an explicitly configured pollEndpoint");
    }
    while (!signal.aborted) {
      const response = await hikcentralRequest(config.pollEndpoint, {
        signal,
        body: config.pollBody,
        method: config.pollMethod,
      });
      if (!response.ok) throw responseError(response, "HikCentral event poll");
      const body = await response.json();
      if (body?.code !== undefined && ![0, "0"].includes(body.code)) {
        throw new Error(`HikCentral event poll returned API code ${String(body.code)}`);
      }
      lastConnectedAt = new Date(now()).toISOString();
      consecutiveFailures = 0;
      for (const payload of payloadsFromHikCentral(body)) {
        await emit(payload, onEvent, { deduplicate: true });
      }
      await sleep(config.pollIntervalMs, signal);
    }
  }

  async function supervise(onEvent, signal) {
    let delay = config.retryMinMs;
    while (!signal.aborted) {
      try {
        if (config.mode === "isapi") await runIsapi(onEvent, signal);
        else await runHikcentral(onEvent, signal);
        delay = config.retryMinMs;
      } catch (error) {
        if (signal.aborted) break;
        lastError = error instanceof Error ? error.message : String(error);
        consecutiveFailures += 1;
        state = "degraded";
        await sleep(delay, signal);
        delay = Math.min(delay * 2, config.retryMaxMs);
      }
    }
  }

  async function start(onEvent) {
    if (typeof onEvent !== "function") throw new TypeError("start(onEvent) requires a callback");
    if (loopPromise) return;
    if (config.mode === "hikcentral" && !config.pollEndpoint) {
      state = "running";
      lastError = null;
      return;
    }
    controller = new AbortController();
    state = "running";
    lastError = null;
    loopPromise = supervise(onEvent, controller.signal).finally(() => {
      loopPromise = null;
      controller = null;
      if (state !== "stopped") state = "idle";
    });
  }

  async function stop() {
    state = "stopped";
    controller?.abort();
    await loopPromise;
  }

  async function ingest(payload, onEvent) {
    if (config.mode !== "hikcentral") {
      throw new Error("Callback ingestion is available only in hikcentral mode");
    }
    if (typeof onEvent !== "function") throw new TypeError("ingest requires an event callback");
    let accepted = 0;
    for (const item of payloadsFromHikCentral(payload)) {
      const before = eventsReceived;
      await emit(item, onEvent, { deduplicate: true });
      if (eventsReceived > before) accepted += 1;
    }
    lastConnectedAt = new Date(now()).toISOString();
    state = "running";
    return accepted;
  }

  function health() {
    const status =
      state === "degraded"
        ? "degraded"
        : state === "running"
          ? "running"
          : state === "idle"
            ? "idle"
            : "stopped";
    return {
      ok: state === "running" && consecutiveFailures === 0,
      provider: "hikvision",
      adapter: "hikvision",
      mode: config.mode,
      status,
      state,
      lastConnectedAt,
      lastEventAt,
      lastError,
      consecutiveFailures,
      eventsReceived,
      eventsDropped,
    };
  }

  return { start, stop, health, testConnection, ingest };
}

export default createAdapter;
