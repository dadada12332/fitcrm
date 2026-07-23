import type { NextRequest } from "next/server"

type Bucket = { count: number; resetsAt: number }

const globalBuckets = globalThis as typeof globalThis & {
  __fitcrmAccessBuckets?: Map<string, Bucket>
}

const buckets = globalBuckets.__fitcrmAccessBuckets ?? new Map<string, Bucket>()
globalBuckets.__fitcrmAccessBuckets = buckets

function requestIp(request: NextRequest) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown"
}

/**
 * Per-instance protection. The production Vercel Firewall remains the
 * authoritative distributed rate limit; this guard rejects obvious bursts
 * before they trigger a Supabase lookup on the current function instance.
 */
export function allowAccessControlRequest(request: NextRequest, route: string, limit = 300) {
  const now = Date.now()
  const key = `${route}:${requestIp(request)}`
  const existing = buckets.get(key)
  if (!existing || existing.resetsAt <= now) {
    if (buckets.size > 5_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetsAt <= now) buckets.delete(bucketKey)
      }
      if (buckets.size > 5_000) buckets.clear()
    }
    buckets.set(key, { count: 1, resetsAt: now + 60_000 })
    return true
  }
  existing.count += 1
  return existing.count <= limit
}
