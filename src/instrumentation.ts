import type { Instrumentation } from "next"

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error))
  if (normalizedError.name === "AbortError" || normalizedError.message.toLowerCase() === "aborted") {
    return
  }

  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined

  console.error(JSON.stringify({
    level: "error",
    event: "next_request_error",
    message: normalizedError.message,
    digest,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
    router: context.routerKind,
    timestamp: new Date().toISOString(),
  }))
}
