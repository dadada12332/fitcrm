const SENSITIVE_KEY = /(authorization|password|secret|token|api.?key|cookie|credential|pin|card)/i

function redact(value, depth = 0) {
  if (depth > 5) return "[truncated]"
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1))
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : redact(item, depth + 1),
    ]),
  )
}

export function createLogger(output = console) {
  function write(level, message, fields = {}) {
    const record = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redact(fields),
    })
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log"
    output[method](record)
  }

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  }
}
