/** Lightweight server-side performance logger. Only active in development. */

export function perfStart(label: string): () => void {
  if (process.env.NODE_ENV !== "development") return () => {}
  const t = Date.now()
  return () => {
    const ms = Date.now() - t
    const icon = ms < 50 ? "✅" : ms < 200 ? "🟡" : "🔴"
    console.log(`${icon} [perf] ${label}: ${ms}ms`)
  }
}

export function perfLog(label: string, ms: number) {
  if (process.env.NODE_ENV !== "development") return
  const icon = ms < 50 ? "✅" : ms < 200 ? "🟡" : "🔴"
  console.log(`${icon} [perf] ${label}: ${ms}ms`)
}
