import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/crypto"
import { createServiceClient } from "@/lib/supabase/service"

export { instagramStateHash, parseSignedRequest, verifyMetaSignature } from "./instagram-security"

const PROVIDER = "instagram"
const DEFAULT_VERSION = "v25.0"

export type InstagramConnection = {
  id: string
  club_id: string
  external_account_id: string
  username: string | null
  display_name: string | null
  account_type: string | null
  secret_enc: string
  token_expires_at: string | null
  scopes: string[]
  status: "connected" | "error" | "expired" | "revoked"
  metadata: Record<string, unknown>
  last_synced_at: string | null
  last_error: string | null
}

export function getInstagramConfig() {
  const appId = process.env.INSTAGRAM_APP_ID ?? ""
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? ""
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
  return {
    appId,
    appSecret,
    verifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "",
    version: process.env.META_GRAPH_API_VERSION || DEFAULT_VERSION,
    redirectUri: `${appUrl}/api/integrations/instagram/callback`,
    configured: Boolean(appId && appSecret),
  }
}

async function graph<T>(path: string, token: string, params: Record<string, string> = {}) {
  const { version } = getInstagramConfig()
  const url = new URL(`https://graph.instagram.com/${version}/${path.replace(/^\//, "")}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set("access_token", token)
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json() as T & { error?: { message?: string; code?: number } }
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || `Instagram API ${response.status}`) as Error & { status?: number; code?: number }
    error.status = response.status
    error.code = payload.error?.code
    throw error
  }
  return { payload, headers: response.headers }
}

async function refreshTokenIfNeeded(connection: InstagramConnection) {
  let token = decryptIntegrationSecret(connection.secret_enc)
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  if (!expiresAt || expiresAt - Date.now() > 7 * 86_400_000) return token

  const url = new URL("https://graph.instagram.com/refresh_access_token")
  url.searchParams.set("grant_type", "ig_refresh_token")
  url.searchParams.set("access_token", token)
  const response = await fetch(url, { cache: "no-store" })
  const result = await response.json() as { access_token?: string; expires_in?: number; error?: { message?: string } }
  if (!response.ok || !result.access_token) throw new Error(result.error?.message || "Не удалось обновить токен Instagram")
  token = result.access_token
  await createServiceClient().from("integration_connections").update({
    secret_enc: encryptIntegrationSecret(token),
    token_expires_at: new Date(Date.now() + (result.expires_in ?? 5_184_000) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("club_id", connection.club_id).eq("provider", PROVIDER)
  return token
}

function insightMap(data: Array<{ name: string; values?: Array<{ value: unknown }>; total_value?: { value: unknown } }>) {
  return Object.fromEntries(data.map((item) => [item.name, item.total_value?.value ?? item.values?.at(-1)?.value ?? null]))
}

export async function syncInstagramConnection(connection: InstagramConnection) {
  const service = createServiceClient()
  const { data: run, error: runError } = await service.from("integration_sync_runs").insert({
    club_id: connection.club_id, provider: PROVIDER, status: "running",
  }).select("id").single()
  if (runError || !run) throw runError ?? new Error("Не удалось начать синхронизацию")

  try {
    const token = await refreshTokenIfNeeded(connection)
    const { payload: mediaResult, headers } = await graph<{ data: Array<Record<string, unknown>> }>("me/media", token, {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: "50",
    })
    const rows = []
    for (const media of mediaResult.data ?? []) {
      let insights: Record<string, unknown> = {}
      try {
        const result = await graph<{ data: Array<{ name: string; values?: Array<{ value: unknown }>; total_value?: { value: unknown } }> }>(`${media.id}/insights`, token, {
          metric: "views,reach,saved,shares,total_interactions",
        })
        insights = insightMap(result.payload.data ?? [])
      } catch {
        // Metrics vary by media type and account capabilities; base counters still sync.
      }
      rows.push({
        club_id: connection.club_id,
        media_id: String(media.id),
        media_type: String(media.media_type ?? "POST"),
        caption: typeof media.caption === "string" ? media.caption : null,
        media_url: typeof media.media_url === "string" ? media.media_url : null,
        thumbnail_url: typeof media.thumbnail_url === "string" ? media.thumbnail_url : null,
        permalink: typeof media.permalink === "string" ? media.permalink : null,
        published_at: typeof media.timestamp === "string" ? media.timestamp : null,
        like_count: Number(media.like_count ?? 0),
        comments_count: Number(media.comments_count ?? 0),
        insights,
        synced_at: new Date().toISOString(),
      })
    }
    if (rows.length) {
      const { error } = await service.from("instagram_media").upsert(rows, { onConflict: "club_id,media_id" })
      if (error) throw error
    }

    let accountMetrics: Record<string, unknown> = {}
    try {
      const result = await graph<{ data: Array<{ name: string; values?: Array<{ value: unknown }>; total_value?: { value: unknown } }> }>("me/insights", token, {
        metric: "reach,views,profile_views",
        period: "day",
        metric_type: "total_value",
      })
      accountMetrics = insightMap(result.payload.data ?? [])
      await service.from("instagram_daily_insights").upsert({
        club_id: connection.club_id,
        insight_date: new Date().toISOString().slice(0, 10),
        metrics: accountMetrics,
        synced_at: new Date().toISOString(),
      }, { onConflict: "club_id,insight_date" })
    } catch {
      // App Review or account type may not grant account-level insights yet.
    }

    const rateLimit = {
      appUsage: headers.get("x-app-usage"),
      businessUsage: headers.get("x-business-use-case-usage"),
    }
    const now = new Date().toISOString()
    await Promise.all([
      service.from("integration_connections").update({ status: "connected", last_synced_at: now, last_error: null, updated_at: now })
        .eq("id", connection.id).eq("club_id", connection.club_id),
      service.from("integration_sync_runs").update({ status: "completed", items_synced: rows.length, rate_limit: rateLimit, finished_at: now })
        .eq("id", run.id).eq("club_id", connection.club_id),
    ])
    return { items: rows.length, accountMetrics }
  } catch (cause) {
    const error = cause as Error & { status?: number; code?: number }
    const status = error.status === 429 || error.code === 4 || error.code === 17 ? "rate_limited" : "failed"
    const message = error.message.slice(0, 500)
    const now = new Date().toISOString()
    await Promise.all([
      service.from("integration_connections").update({ status: "error", last_error: message, updated_at: now })
        .eq("id", connection.id).eq("club_id", connection.club_id),
      service.from("integration_sync_runs").update({ status, error_message: message, finished_at: now })
        .eq("id", run.id).eq("club_id", connection.club_id),
    ])
    throw error
  }
}
