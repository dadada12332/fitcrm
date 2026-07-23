const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MIN_POLL_INTERVAL_MS = 250;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_SEEN_EVENT_IDS = 10_000;

/**
 * Field profiles for transaction objects returned by the corresponding ZKTeco
 * product APIs. HTTP paths are deliberately not included: they differ between
 * licensed products and releases and must come from the documentation shipped
 * with the installed server.
 */
const MAPPING_PROFILES = Object.freeze({
  "zkbio-cvsecurity-access": Object.freeze({
    list: ["data", "data"],
    id: ["id"],
    occurredAt: ["event_time"],
    personId: ["pin"],
    deviceId: ["sn"],
    direction: ["in_out_state"],
    eventType: ["event_type"],
    result: ["event_type"],
    defaultResult: "unknown",
    resultMap: Object.freeze({}),
    directionMap: Object.freeze({ "0": "entry", "1": "exit" }),
  }),
  "zkbiotime-attendance": Object.freeze({
    list: ["data"],
    id: ["id"],
    occurredAt: ["punch_time"],
    personId: ["emp_code"],
    deviceId: ["terminal_sn"],
    direction: ["punch_state"],
    eventType: ["verify_type"],
    defaultResult: "allowed",
    directionMap: Object.freeze({
      "0": "entry",
      "1": "exit",
      "2": "exit",
      "3": "entry",
      "4": "entry",
      "5": "exit",
    }),
  }),
  "biotime-attendance": Object.freeze({
    list: ["data"],
    id: ["id"],
    occurredAt: ["punch_time"],
    personId: ["emp_code"],
    deviceId: ["terminal_sn"],
    direction: ["punch_state"],
    eventType: ["verify_type"],
    defaultResult: "allowed",
    directionMap: Object.freeze({
      "0": "entry",
      "1": "exit",
      "2": "exit",
      "3": "entry",
      "4": "entry",
      "5": "exit",
    }),
  }),
});

class AdapterError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ZKTecoAdapterError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function asPath(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((part) => typeof part !== "string" || !part)) {
    throw new AdapterError("INVALID_CONFIG", `${label} must be a non-empty array of property names`);
  }
  return [...value];
}

function valueAt(input, path) {
  let value = input;
  for (const part of path) {
    if (value === null || typeof value !== "object" || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

function resolveMapping(mapping = {}) {
  if (!mapping.profile) {
    throw new AdapterError(
      "INVALID_CONFIG",
      "mapping.profile is required; select a documented profile or provide mapping.profile='custom'",
    );
  }

  let base;
  if (mapping.profile === "custom") {
    base = {};
  } else {
    base = MAPPING_PROFILES[mapping.profile];
    if (!base) {
      throw new AdapterError(
        "INVALID_CONFIG",
        `Unsupported mapping profile '${mapping.profile}'. Supported profiles: ${Object.keys(MAPPING_PROFILES).join(", ")}, custom`,
      );
    }
  }

  const merged = { ...base, ...mapping };
  return Object.freeze({
    profile: mapping.profile,
    list: asPath(merged.list, "mapping.list"),
    id: asPath(merged.id, "mapping.id"),
    occurredAt: asPath(merged.occurredAt, "mapping.occurredAt"),
    personId: merged.personId ? asPath(merged.personId, "mapping.personId") : null,
    deviceId: merged.deviceId ? asPath(merged.deviceId, "mapping.deviceId") : null,
    direction: merged.direction ? asPath(merged.direction, "mapping.direction") : null,
    eventType: merged.eventType ? asPath(merged.eventType, "mapping.eventType") : null,
    result: merged.result ? asPath(merged.result, "mapping.result") : null,
    directionMap: Object.freeze({ ...(merged.directionMap ?? {}) }),
    resultMap: Object.freeze({ ...(merged.resultMap ?? {}) }),
    defaultResult: ["allowed", "denied", "unknown"].includes(merged.defaultResult)
      ? merged.defaultResult
      : "unknown",
  });
}

function validateRelativePath(path, label) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new AdapterError("INVALID_CONFIG", `${label} must be an absolute URL path beginning with one '/'`);
  }
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname.split("/").includes("..")) {
    throw new AdapterError("INVALID_CONFIG", `${label} must not escape the configured base URL`);
  }
  return path;
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object") {
    throw new AdapterError("INVALID_CONFIG", "ZKTeco adapter config is required");
  }

  let baseUrl;
  try {
    baseUrl = new URL(config.baseUrl);
  } catch {
    throw new AdapterError("INVALID_CONFIG", "baseUrl must be a valid HTTP(S) URL");
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new AdapterError("INVALID_CONFIG", "baseUrl must use HTTP or HTTPS");
  }
  if (baseUrl.username || baseUrl.password) {
    throw new AdapterError("INVALID_CONFIG", "baseUrl must not contain credentials");
  }
  if (baseUrl.protocol === "http:" && config.allowInsecureHttp !== true) {
    throw new AdapterError(
      "INSECURE_TRANSPORT",
      "Plain HTTP is disabled; use HTTPS or explicitly set allowInsecureHttp=true for a trusted isolated LAN",
    );
  }

  const auth = config.auth ?? {};
  const authMode = auth.mode ?? "token";
  if (!["token", "static-bearer", "none"].includes(authMode)) {
    throw new AdapterError("INVALID_CONFIG", "auth.mode must be token, static-bearer, or none");
  }
  if (authMode === "token") {
    validateRelativePath(auth.path, "auth.path");
    if (!auth.body || typeof auth.body !== "object" || Array.isArray(auth.body)) {
      throw new AdapterError("INVALID_CONFIG", "auth.body must contain the documented login request body");
    }
    asPath(auth.tokenPath, "auth.tokenPath");
  }
  if (authMode === "static-bearer" && (typeof auth.token !== "string" || !auth.token)) {
    throw new AdapterError("INVALID_CONFIG", "auth.token is required for static-bearer mode");
  }

  const events = config.events ?? {};
  validateRelativePath(events.path, "events.path");
  if (events.query !== undefined && (!events.query || typeof events.query !== "object" || Array.isArray(events.query))) {
    throw new AdapterError("INVALID_CONFIG", "events.query must be an object");
  }
  if (events.sinceParam !== undefined && (typeof events.sinceParam !== "string" || !events.sinceParam)) {
    throw new AdapterError("INVALID_CONFIG", "events.sinceParam must be a non-empty string");
  }

  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < MIN_POLL_INTERVAL_MS) {
    throw new AdapterError("INVALID_CONFIG", `pollIntervalMs must be an integer >= ${MIN_POLL_INTERVAL_MS}`);
  }
  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new AdapterError("INVALID_CONFIG", "requestTimeoutMs must be a positive integer");
  }

  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "") + "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  return Object.freeze({
    baseUrl,
    allowInsecureHttp: config.allowInsecureHttp === true,
    auth: Object.freeze({
      mode: authMode,
      path: auth.path,
      method: auth.method ?? "POST",
      body: auth.body,
      token: auth.token,
      tokenPath: auth.tokenPath ? [...auth.tokenPath] : null,
      header: auth.header ?? "Authorization",
      scheme: auth.scheme ?? "Bearer",
      extraHeaders: { ...(auth.headers ?? {}) },
    }),
    events: Object.freeze({
      path: events.path,
      query: { ...(events.query ?? {}) },
      sinceParam: events.sinceParam,
      extraHeaders: { ...(events.headers ?? {}) },
    }),
    mapping: resolveMapping(config.mapping),
    includeRaw: config.includeRaw === true,
    pollIntervalMs,
    requestTimeoutMs,
  });
}

function safeError(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  };
}

function makeUrl(baseUrl, path, query = {}) {
  const url = new URL(path.replace(/^\/+/, ""), baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function normalizeEvent(raw, mapping) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AdapterError("INVALID_EVENT", "Transaction entry is not an object");
  }
  const id = valueAt(raw, mapping.id);
  const occurredAtValue = valueAt(raw, mapping.occurredAt);
  if ((typeof id !== "string" && typeof id !== "number") || String(id).length === 0) {
    throw new AdapterError("INVALID_EVENT", "Transaction is missing its documented event id");
  }
  if (typeof occurredAtValue !== "string" || !occurredAtValue.trim()) {
    throw new AdapterError("INVALID_EVENT", `Transaction '${id}' is missing its documented timestamp`);
  }
  const timestamp = Date.parse(occurredAtValue);
  if (!Number.isFinite(timestamp)) {
    throw new AdapterError("INVALID_EVENT", `Transaction '${id}' has an invalid timestamp`);
  }

  const optional = (path) => {
    if (!path) return null;
    const value = valueAt(raw, path);
    return value === undefined || value === null ? null : String(value);
  };

  const personId = optional(mapping.personId);
  if (!personId || personId.length > 128) {
    throw new AdapterError("INVALID_EVENT", `Transaction '${id}' is missing a valid person credential`);
  }
  const rawDirection = optional(mapping.direction);
  const rawResult = optional(mapping.result);
  const result = mapping.resultMap[rawResult] ?? mapping.defaultResult;
  if (!["allowed", "denied", "unknown"].includes(result)) {
    throw new AdapterError("INVALID_EVENT", `Transaction '${id}' has an invalid configured result`);
  }

  return Object.freeze({
    externalEventId: String(id),
    occurredAt: new Date(timestamp).toISOString(),
    credentialUid: personId,
    deviceId: optional(mapping.deviceId),
    direction: mapping.directionMap[rawDirection] ?? "unknown",
    eventType: "passage",
    result,
    payload: Object.freeze({
      zktecoEventType: optional(mapping.eventType),
      zktecoDirection: rawDirection,
      zktecoResult: rawResult,
      ...(mapping.includeRaw ? { raw } : {}),
    }),
  });
}

export function createAdapter(config, deps = {}) {
  const options = normalizeConfig(config);
  const fetchImpl = deps.fetchImpl ?? deps.fetch ?? globalThis.fetch;
  const setIntervalImpl = deps.setInterval ?? globalThis.setInterval;
  const clearIntervalImpl = deps.clearInterval ?? globalThis.clearInterval;
  const now = deps.now ?? (() => new Date());
  const logger = deps.logger ?? { warn() {} };

  if (typeof fetchImpl !== "function") throw new AdapterError("INVALID_DEPS", "A fetch implementation is required");

  let state = "stopped";
  let timer = null;
  let onEvent = null;
  let token = options.auth.mode === "static-bearer" ? options.auth.token : null;
  let activeController = null;
  let pollPromise = null;
  let lastPollAt = null;
  let lastSuccessAt = null;
  let lastEventAt = null;
  let lastOccurredAt = null;
  let lastError = null;
  let deliveredEvents = 0;
  const seenIds = new Set();

  async function request(url, init = {}) {
    const controller = new AbortController();
    activeController = controller;
    const timeout = setTimeout(() => controller.abort(new Error("request timeout")), options.requestTimeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!response || typeof response.ok !== "boolean" || typeof response.json !== "function") {
        throw new AdapterError("INVALID_RESPONSE", "fetch returned an invalid Response");
      }
      if (!response.ok) {
        throw new AdapterError("HTTP_ERROR", `ZKTeco server returned HTTP ${response.status}`, {
          status: response.status,
        });
      }
      try {
        return await response.json();
      } catch {
        throw new AdapterError("INVALID_JSON", "ZKTeco server returned a non-JSON response");
      }
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) {
        throw new AdapterError("REQUEST_TIMEOUT", `ZKTeco request exceeded ${options.requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      if (activeController === controller) activeController = null;
    }
  }

  async function authenticate() {
    if (options.auth.mode === "none") return null;
    if (options.auth.mode === "static-bearer") return token;

    const payload = await request(makeUrl(options.baseUrl, options.auth.path), {
      method: options.auth.method,
      headers: { "content-type": "application/json", accept: "application/json", ...options.auth.extraHeaders },
      body: JSON.stringify(options.auth.body),
    });
    const nextToken = valueAt(payload, options.auth.tokenPath);
    if (typeof nextToken !== "string" || !nextToken) {
      throw new AdapterError("AUTH_SHAPE_MISMATCH", "Authentication response does not contain a token at auth.tokenPath");
    }
    token = nextToken;
    return token;
  }

  function authHeaders() {
    if (options.auth.mode === "none") return {};
    if (!token) throw new AdapterError("NOT_AUTHENTICATED", "No authentication token is available");
    return { [options.auth.header]: `${options.auth.scheme} ${token}`.trim() };
  }

  async function fetchEvents({ probe = false } = {}) {
    if (options.auth.mode === "token" && !token) await authenticate();
    const query = { ...options.events.query };
    if (options.events.sinceParam && lastOccurredAt) query[options.events.sinceParam] = lastOccurredAt;
    const url = makeUrl(options.baseUrl, options.events.path, query);

    let payload;
    try {
      payload = await request(url, {
        method: "GET",
        headers: { accept: "application/json", ...options.events.extraHeaders, ...authHeaders() },
      });
    } catch (error) {
      if (options.auth.mode === "token" && error?.details?.status === 401) {
        token = null;
        await authenticate();
        payload = await request(url, {
          method: "GET",
          headers: { accept: "application/json", ...options.events.extraHeaders, ...authHeaders() },
        });
      } else {
        throw error;
      }
    }

    const rows = valueAt(payload, options.mapping.list);
    if (!Array.isArray(rows)) {
      throw new AdapterError(
        "EVENTS_SHAPE_MISMATCH",
        `Events response does not contain an array at mapping.list (${options.mapping.list.join(".")})`,
      );
    }
    const events = rows.map((row) => normalizeEvent(row, {
      ...options.mapping,
      includeRaw: options.includeRaw,
    }));
    if (!probe) {
      // Validate the complete page before delivering any event. A malformed row
      // must not result in a partially accepted access-control batch.
      for (const event of events) {
        if (seenIds.has(event.externalEventId)) continue;
        await onEvent(event);
        seenIds.add(event.externalEventId);
        deliveredEvents += 1;
        lastEventAt = now().toISOString();
        if (!lastOccurredAt || event.occurredAt > lastOccurredAt) lastOccurredAt = event.occurredAt;
        await deps.saveCheckpoint?.({
          lastOccurredAt,
          seenIds: [...seenIds].slice(-MAX_SEEN_EVENT_IDS),
        });
      }
      while (seenIds.size > MAX_SEEN_EVENT_IDS) seenIds.delete(seenIds.values().next().value);
    }
    return events.length;
  }

  async function poll() {
    if (state !== "running") return;
    lastPollAt = now().toISOString();
    try {
      const count = await fetchEvents();
      lastSuccessAt = now().toISOString();
      lastError = null;
      return count;
    } catch (error) {
      lastError = { ...safeError(error), at: now().toISOString() };
      logger.warn?.("ZKTeco polling failed", lastError);
      throw error;
    }
  }

  async function scheduledPoll() {
    if (pollPromise) return;
    pollPromise = poll().catch(() => {}).finally(() => {
      pollPromise = null;
    });
    await pollPromise;
  }

  return Object.freeze({
    async start(handler) {
      if (typeof handler !== "function") throw new AdapterError("INVALID_HANDLER", "start(onEvent) requires a function");
      if (state === "running") return;
      onEvent = handler;
      const checkpoint = await deps.loadCheckpoint?.();
      if (typeof checkpoint?.lastOccurredAt === "string" && Number.isFinite(Date.parse(checkpoint.lastOccurredAt))) {
        lastOccurredAt = new Date(checkpoint.lastOccurredAt).toISOString();
      }
      if (Array.isArray(checkpoint?.seenIds)) {
        for (const id of checkpoint.seenIds.slice(-MAX_SEEN_EVENT_IDS)) {
          if (typeof id === "string" && id) seenIds.add(id);
        }
      }
      state = "running";
      try {
        await poll();
      } catch (error) {
        state = "degraded";
        onEvent = null;
        throw error;
      }
      timer = setIntervalImpl(scheduledPoll, options.pollIntervalMs);
    },

    async stop() {
      state = "stopped";
      if (timer !== null) clearIntervalImpl(timer);
      timer = null;
      activeController?.abort();
      if (pollPromise) await pollPromise.catch(() => {});
      pollPromise = null;
      onEvent = null;
    },

    health() {
      return Object.freeze({
        ok: state === "running" && lastError === null,
        state,
        productProfile: options.mapping.profile,
        transportSecure: options.baseUrl.protocol === "https:",
        lastPollAt,
        lastSuccessAt,
        lastEventAt,
        lastError,
        deliveredEvents,
      });
    },

    async testConnection() {
      try {
        if (options.auth.mode === "token") {
          token = null;
          await authenticate();
        }
        const eventCount = await fetchEvents({ probe: true });
        return Object.freeze({
          ok: true,
          productProfile: options.mapping.profile,
          eventCount,
          checkedAt: now().toISOString(),
        });
      } catch (error) {
        const diagnostic = { ...safeError(error), at: now().toISOString() };
        return Object.freeze({
          ok: false,
          productProfile: options.mapping.profile,
          error: diagnostic.message,
          diagnostic: Object.freeze(diagnostic),
          checkedAt: now().toISOString(),
        });
      }
    },
  });
}

export { AdapterError, MAPPING_PROFILES };
