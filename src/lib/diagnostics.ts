// ── Чёрный ящик диагностики ────────────────────────────────────────────────
// Клиентский кольцевой буфер последних JS/API-ошибок + текущий route.
// Ничего никуда не шлёт, пока не создаётся обращение → тогда collectClientMeta()
// подмешивает снимок в support_tickets.client_meta (скрыто от юзера, видно поддержке).

type JsError = { message: string; source?: string; at: string }
type ApiError = { method: string; path: string; status: number; at: string }

const RING = 6
const jsErrors: JsError[] = []
const apiErrors: ApiError[] = []
let lastRoute = ""
let started = false

function push<T>(arr: T[], item: T) {
  arr.push(item)
  if (arr.length > RING) arr.shift()
}

/** Инициализировать перехватчики один раз (клиент). */
export function initDiagnostics() {
  if (started || typeof window === "undefined") return
  started = true

  window.addEventListener("error", (e) => {
    push(jsErrors, {
      message: String(e.message || e.error?.message || "error").slice(0, 300),
      source: e.filename ? `${e.filename}:${e.lineno}` : undefined,
      at: new Date().toISOString(),
    })
  })

  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    push(jsErrors, {
      message: String(reason?.message ?? reason ?? "unhandledrejection").slice(0, 300),
      at: new Date().toISOString(),
    })
  })

  // Обёртка fetch — фиксируем только неуспешные ответы (без тел и query, чтобы не утащить секреты).
  const orig = window.fetch.bind(window)
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args
    const method = (init?.method || (typeof input !== "string" && "method" in input ? (input as Request).method : "GET") || "GET").toUpperCase()
    let path = ""
    try {
      const raw = typeof input === "string" ? input : (input as Request | URL).toString()
      path = new URL(raw, window.location.origin).pathname
    } catch { path = "" }
    try {
      const res = await orig(...args)
      if (!res.ok) push(apiErrors, { method, path, status: res.status, at: new Date().toISOString() })
      return res
    } catch (err) {
      push(apiErrors, { method, path, status: 0, at: new Date().toISOString() })
      throw err
    }
  }
}

/** Запомнить текущий маршрут (вызывается из провайдера при смене pathname). */
export function setDiagnosticsRoute(route: string) {
  lastRoute = route
}

/** Снимок для client_meta при создании обращения. */
export function collectClientMeta(extra?: Record<string, unknown>): Record<string, unknown> {
  if (typeof window === "undefined") return { ...extra }
  return {
    url: window.location.href,
    last_route: lastRoute || window.location.pathname,
    user_agent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    app_version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    last_js_errors: jsErrors.slice(-3),
    last_api_errors: apiErrors.slice(-3),
    captured_at: new Date().toISOString(),
    ...extra,
  }
}
