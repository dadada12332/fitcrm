export class FitCrmCloudClient {
  constructor(config, { fetchImpl = globalThis.fetch, logger } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable")
    this.config = config
    this.fetch = fetchImpl
    this.logger = logger
  }

  async request(path, body) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const response = await this.fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fitcrm-access-key": this.config.accessKey,
          "user-agent": "FitCRM-Bridge/0.1",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(`FitCRM returned HTTP ${response.status}`)
        error.status = response.status
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500
        error.payload = payload
        throw error
      }
      if (payload?.ok === false || payload?.reasonCode === "storage_error" || payload?.reasonCode === "processing_error") {
        const error = new Error(`FitCRM rejected event: ${payload?.error ?? payload?.reasonCode ?? "logical_error"}`)
        error.retryable = payload?.error === "storage_error"
          || payload?.error === "processing_error"
          || payload?.reasonCode === "storage_error"
          || payload?.reasonCode === "processing_error"
        error.payload = payload
        throw error
      }
      return payload
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("FitCRM request timed out")
        timeoutError.retryable = true
        throw timeoutError
      }
      if (error.retryable === undefined) error.retryable = true
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  decision(event) {
    return this.request(`/api/access-control/${this.config.integrationId}/decision`, event)
  }

  event(event) {
    return this.request(`/api/access-control/${this.config.integrationId}/events`, event)
  }

  heartbeat(bridgeId) {
    return this.event({
      eventType: "heartbeat",
      direction: "unknown",
      result: "allowed",
      occurredAt: new Date().toISOString(),
      deviceId: bridgeId,
      payload: { bridgeVersion: "0.1.0" },
    })
  }
}
