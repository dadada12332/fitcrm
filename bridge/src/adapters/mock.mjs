export function createAdapter(config = {}) {
  let timer = null
  let state = { status: "idle", lastEventAt: null, lastError: null }
  return {
    async start(onEvent) {
      state = { ...state, status: "connected" }
      if (Array.isArray(config.events)) {
        let index = 0
        timer = setInterval(async () => {
          const event = config.events[index++]
          if (!event) return
          state.lastEventAt = new Date().toISOString()
          await onEvent(event)
          if (index >= config.events.length) clearInterval(timer)
        }, config.pollIntervalMs ?? 250)
      }
    },
    async stop() {
      if (timer) clearInterval(timer)
      state.status = "stopped"
    },
    health() {
      return { ...state, provider: "mock" }
    },
    async testConnection() {
      return { ok: true, provider: "mock", capabilities: ["events", "decision"] }
    },
  }
}
