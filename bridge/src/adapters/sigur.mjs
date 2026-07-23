/**
 * Sigur Public REST API adapter.
 *
 * Contract:
 *   createAdapter(config, deps) -> {
 *     start(onEvent): Promise<void>,
 *     stop(): Promise<void>,
 *     health(): object,
 *     testConnection(): Promise<object>
 *   }
 *
 * The documented API root is http://<server>:9500/api/v1. `baseUrl` is the
 * server origin; `apiBasePath` may be changed for reverse-proxy deployments.
 */

const DEFAULT_API_BASE_PATH = "/api/v1";
const DEFAULT_EVENTS_PATH = "/events";
const DEFAULT_AUTH_PATH = "/users/auth";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_BATCH_SIZE = 100;

export function createAdapter(config = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? deps.fetch ?? globalThis.fetch;
  const setTimer = deps.setTimeout ?? globalThis.setTimeout;
  const clearTimer = deps.clearTimeout ?? globalThis.clearTimeout;
  const now = deps.now ?? (() => new Date());
  const logger = deps.logger ?? {};

  const settings = {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    apiBasePath: normalizePath(config.apiBasePath ?? DEFAULT_API_BASE_PATH),
    authPath: normalizePath(config.authPath ?? DEFAULT_AUTH_PATH),
    eventsPath: normalizePath(config.eventsPath ?? DEFAULT_EVENTS_PATH),
    username: nonEmptyString(config.username),
    password: nonEmptyString(config.password),
    token: nonEmptyString(config.token),
    pollIntervalMs: positiveInteger(config.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS),
    requestTimeoutMs: positiveInteger(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
    batchSize: boundedInteger(config.batchSize, DEFAULT_BATCH_SIZE, 1, 3_000),
    replayExisting: config.replayExisting === true,
    initialCursor: normalizeCursor(config.initialCursor),
    eventQuery: isPlainObject(config.eventQuery) ? config.eventQuery : {},
    eventMap: resolveEventMap(config.eventMap ?? deps.mapping?.sigurEventMap),
    eventTypes: isPlainObject(config.eventTypes) ? config.eventTypes : {},
    results: isPlainObject(config.results) ? config.results : {},
    includeRaw: config.includeRaw === true,
  };

  let running = false;
  let timer = null;
  let onEvent = null;
  let accessToken = settings.token;
  let tokenExpiresAt = null;
  let cursor = settings.initialCursor;
  let initialized = cursor !== null || settings.replayExisting;
  let pollPromise = null;

  const state = {
    startedAt: null,
    stoppedAt: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastEventAt: null,
    lastError: null,
    eventsReceived: 0,
  };

  function capabilityReport() {
    const baseConfigured = settings.baseUrl !== null;
    const credentialsConfigured =
      Boolean(settings.token) || Boolean(settings.username && settings.password);
    const mappingConfigured = Boolean(settings.eventMap.credentialUid);

    return {
      restApi: {
        supported: true,
        configured: baseConfigured && credentialsConfigured && mappingConfigured,
        authentication: settings.token ? "bearer_token" : "username_password",
        events: {
          supported: true,
          mode: "poll",
          path: joinApiPath(settings.apiBasePath, settings.eventsPath),
          mappingConfigured,
        },
      },
      webDelegation: {
        supported: false,
        reason:
          "Sigur documents HTTP(S) POST with JSON, but the public product guide does not publish its payload/response schema; configure a dedicated inbound handler only from the Sigur-supplied protocol guide.",
      },
    };
  }

  function health() {
    const configured = Boolean(
      settings.baseUrl &&
        (settings.token || (settings.username && settings.password)) &&
        settings.eventMap.credentialUid,
    );
    const status = !configured
      ? "misconfigured"
      : state.lastError
        ? "degraded"
        : running
          ? "running"
          : "stopped";

    return {
      ok: configured && running && state.lastError === null,
      provider: "sigur",
      status,
      running,
      cursor,
      ...state,
      capabilities: capabilityReport(),
    };
  }

  async function testConnection() {
    const configurationError = getConfigurationError(settings, fetchImpl);
    if (configurationError) {
      return {
        ok: false,
        provider: "sigur",
        error: configurationError,
        capabilities: capabilityReport(),
      };
    }

    try {
      await ensureAuthenticated(true);
      const query = new URLSearchParams({ limit: "1", sortBy: "timestamp", sortOrder: "DESC" });
      const sample = await request(`${settings.eventsPath}?${query.toString()}`, {
        retryAuth: true,
      });
      if (!Array.isArray(sample)) {
        throw new Error("Sigur events response must be a JSON array.");
      }
      if (sample.length > 0) mapEvent(sample[0], settings);
      return {
        ok: true,
        provider: "sigur",
        message: "Authenticated and read the Sigur events endpoint.",
        capabilities: capabilityReport(),
      };
    } catch (error) {
      return {
        ok: false,
        provider: "sigur",
        error: safeError(error),
        capabilities: capabilityReport(),
      };
    }
  }

  async function start(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Sigur adapter start(onEvent) requires a function.");
    }
    if (running) return;

    const configurationError = getConfigurationError(settings, fetchImpl);
    if (configurationError) throw new Error(configurationError);

    onEvent = callback;
    const checkpoint = await deps.loadCheckpoint?.();
    if (Number.isSafeInteger(checkpoint?.cursor) && checkpoint.cursor >= 0) {
      cursor = checkpoint.cursor;
      initialized = true;
    }
    running = true;
    state.startedAt = nowIso(now);
    state.stoppedAt = null;
    state.lastError = null;

    pollPromise = poll({ propagate: true });
    try {
      await pollPromise;
    } catch (error) {
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
      onEvent = null;
      throw error;
    }
  }

  async function stop() {
    running = false;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    await pollPromise?.catch(() => {});
    pollPromise = null;
    onEvent = null;
    state.stoppedAt = nowIso(now);
  }

  async function poll({ propagate = false } = {}) {
    try {
      state.lastAttemptAt = nowIso(now);
      await ensureAuthenticated();

      if (!initialized) {
        const latest = await fetchEvents({
          limit: 1,
          sortBy: "timestamp",
          sortOrder: "DESC",
        });
        cursor = maxEventId(latest, cursor);
        initialized = true;
        if (cursor !== null) await deps.saveCheckpoint?.({ cursor });
      } else {
        const events = await fetchEvents({
          limit: settings.batchSize,
          sortBy: "timestamp",
          sortOrder: "ASC",
          ...(cursor === null ? {} : { lastId: cursor }),
        });

        for (const event of sortByNumericId(events)) {
          if (!running) break;
          await onEvent(mapEvent(event, settings));
          cursor = maxEventId([event], cursor);
          await deps.saveCheckpoint?.({ cursor });
          state.eventsReceived += 1;
          state.lastEventAt = nowIso(now);
        }
      }

      state.lastSuccessAt = nowIso(now);
      state.lastError = null;
    } catch (error) {
      state.lastError = safeError(error);
      logger.warn?.("Sigur event poll failed", { error: state.lastError });
      if (propagate) throw error;
    } finally {
      pollPromise = null;
      if (running) {
        timer = setTimer(() => {
          timer = null;
          pollPromise = poll();
        }, settings.pollIntervalMs);
      }
    }
  }

  async function fetchEvents(defaultQuery) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...settings.eventQuery, ...defaultQuery })) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const result = await request(`${settings.eventsPath}?${query.toString()}`, {
      retryAuth: true,
    });
    if (!Array.isArray(result)) {
      throw new Error("Sigur events response must be a JSON array.");
    }
    return result;
  }

  async function ensureAuthenticated(force = false) {
    if (settings.token) {
      accessToken = settings.token;
      return;
    }
    if (!force && accessToken && !isExpiring(tokenExpiresAt, now)) return;

    const response = await rawRequest(settings.authPath, {
      method: "POST",
      body: JSON.stringify({
        username: settings.username,
        password: settings.password,
      }),
      authenticated: false,
    });
    if (!response || typeof response.token !== "string" || response.token.length === 0) {
      throw new Error("Sigur authentication response did not contain a token.");
    }
    accessToken = response.token;
    tokenExpiresAt = parseDate(response.expiresAt);
  }

  async function request(path, { retryAuth = false, ...options } = {}) {
    try {
      return await rawRequest(path, { ...options, authenticated: true });
    } catch (error) {
      if (retryAuth && error?.status === 401 && !settings.token) {
        accessToken = null;
        tokenExpiresAt = null;
        await ensureAuthenticated(true);
        return rawRequest(path, { ...options, authenticated: true });
      }
      throw error;
    }
  }

  async function rawRequest(path, { authenticated, ...options }) {
    const controller = new AbortController();
    const timeout = setTimer(() => controller.abort(), settings.requestTimeoutMs);
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (authenticated) headers.set("Authorization", `Bearer ${accessToken}`);

    try {
      const response = await fetchImpl(buildUrl(settings, path), {
        ...options,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Sigur REST API returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Sigur REST API request timed out after ${settings.requestTimeoutMs} ms.`);
      }
      throw error;
    } finally {
      clearTimer(timeout);
    }
  }

  return { start, stop, health, testConnection };
}

function mapEvent(raw, settings) {
  if (!isPlainObject(raw)) throw new Error("Sigur event must be a JSON object.");

  const externalEventId = requiredMappedString(raw, settings.eventMap.externalEventId, "external event id");
  const credentialUid = requiredMappedString(raw, settings.eventMap.credentialUid, "credential UID");
  const occurredAtValue = requiredMappedString(raw, settings.eventMap.occurredAt, "timestamp");
  const occurredAt = new Date(occurredAtValue);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`Sigur event '${externalEventId}' has an invalid timestamp.`);
  }

  const rawType = optionalMappedString(raw, settings.eventMap.eventType);
  const rawResult = optionalMappedString(raw, settings.eventMap.result);
  const rawDirection = optionalMappedString(raw, settings.eventMap.direction);
  const eventType = canonicalValue(settings.eventTypes[rawType], [
    "access_request",
    "passage",
    "denied",
    "unknown",
  ]);
  const mappedResult = canonicalValue(settings.results[rawResult], ["allowed", "denied", "unknown"]);
  const result = mappedResult !== "unknown"
    ? mappedResult
    : eventType === "passage"
      ? "allowed"
      : eventType === "denied"
        ? "denied"
        : "unknown";
  const direction =
    rawDirection === "IN"
      ? "entry"
      : rawDirection === "OUT"
        ? "exit"
        : canonicalValue(rawDirection, ["entry", "exit", "unknown"]);

  const mapped = {
    externalEventId,
    eventType,
    direction,
    result,
    credentialUid,
    occurredAt: occurredAt.toISOString(),
  };
  for (const field of ["deviceId", "doorId", "accessRequestId"]) {
    const value = optionalMappedString(raw, settings.eventMap[field]);
    if (value !== null) mapped[field] = value;
  }
  if (settings.includeRaw) mapped.payload = raw;
  return mapped;
}

function buildUrl(settings, path) {
  const base = new URL(settings.baseUrl);
  base.pathname = joinApiPath(settings.apiBasePath, path.split("?")[0]);
  base.search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  base.hash = "";
  return base;
}

function joinApiPath(left, right) {
  return `${left.replace(/\/+$/, "")}/${right.replace(/^\/+/, "")}`;
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) return "/";
  const path = value.trim();
  if (path.includes("?") || path.includes("#") || path.startsWith("//")) {
    throw new TypeError("Sigur API paths must be relative paths without query or fragment.");
  }
  if (path.split("/").includes("..")) {
    throw new TypeError("Sigur API paths must not escape the configured API base path.");
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function boundedInteger(value, fallback, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function normalizeCursor(value) {
  if (value === undefined || value === null || value === "") return null;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : null;
}

function getConfigurationError(settings, fetchImpl) {
  if (typeof fetchImpl !== "function") return "A Fetch API implementation is required.";
  if (!settings.baseUrl) return "Sigur baseUrl must be an HTTP(S) URL.";
  if (!settings.token && !(settings.username && settings.password)) {
    return "Sigur token or username and password are required.";
  }
  if (!settings.eventMap.credentialUid) {
    return "Sigur eventMap.credentialUid is required; /events exposes accessObjectId, not a documented card/bracelet UID.";
  }
  return null;
}

function parseDate(value) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isExpiring(expiresAt, now) {
  return expiresAt !== null && expiresAt - now().getTime() <= 30_000;
}

function maxEventId(events, current) {
  let maximum = current;
  for (const event of events) {
    const id = Number(event?.id);
    if (Number.isSafeInteger(id) && id >= 0 && (maximum === null || id > maximum)) {
      maximum = id;
    }
  }
  return maximum;
}

function sortByNumericId(events) {
  return [...events].sort((a, b) => {
    const left = Number(a?.id);
    const right = Number(b?.id);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
    return left - right;
  });
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function resolveEventMap(value) {
  const mapping = isPlainObject(value) ? value : {};
  return {
    externalEventId: validMappingPath(mapping.externalEventId) ?? "id",
    occurredAt: validMappingPath(mapping.occurredAt) ?? "timestamp",
    credentialUid: validMappingPath(mapping.credentialUid),
    eventType: validMappingPath(mapping.eventType) ?? "type",
    direction: validMappingPath(mapping.direction) ?? "direction",
    result: validMappingPath(mapping.result),
    deviceId: validMappingPath(mapping.deviceId) ?? "accessPointId",
    doorId: validMappingPath(mapping.doorId),
    accessRequestId: validMappingPath(mapping.accessRequestId),
  };
}

function validMappingPath(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredMappedString(raw, path, label) {
  const value = optionalMappedString(raw, path);
  if (value === null || value.length === 0) {
    throw new Error(`Sigur event is missing its configured ${label}.`);
  }
  return value;
}

function optionalMappedString(raw, path) {
  if (!path) return null;
  const value = getPath(raw, path);
  return value === undefined || value === null ? null : String(value);
}

function canonicalValue(value, allowed) {
  return allowed.includes(value) ? value : "unknown";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nowIso(now) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function safeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
