"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { can } from "@/lib/permissions"
import { createServiceClient } from "@/lib/supabase/service"
import { decryptIntegrationSecret } from "@/lib/crypto"
import { getInstagramConfig, instagramStateHash, syncInstagramConnection, type InstagramConnection } from "@/lib/instagram"

async function context() {
  const [user, club] = await Promise.all([getAuthUser(), getCurrentClub()])
  if (!user) return { ok: false as const, error: "Не авторизован" }
  if (!club) return { ok: false as const, error: "Клуб не найден" }
  if (!can(club.permissions, "settings", "integrations")) return { ok: false as const, error: "Недостаточно прав" }
  return { ok: true as const, user, club }
}

export async function startInstagramOAuthAction(): Promise<{ url?: string; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const config = getInstagramConfig()
  if (!config.configured) return { error: "Сначала добавьте Instagram App ID и App Secret в Vercel" }

  const state = crypto.randomBytes(32).toString("base64url")
  const { error } = await createServiceClient().from("integration_oauth_states").insert({
    state_hash: instagramStateHash(state),
    club_id: ctx.club.clubId,
    provider: "instagram",
    created_by: ctx.user.id,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  })
  if (error) return { error: "Не удалось начать подключение Instagram" }

  const url = new URL("https://www.instagram.com/oauth/authorize")
  url.searchParams.set("client_id", config.appId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", [
    "instagram_business_basic",
    "instagram_business_manage_insights",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_content_publish",
  ].join(","))
  url.searchParams.set("state", state)
  url.searchParams.set("enable_fb_login", "0")
  url.searchParams.set("force_authentication", "1")
  return { url: url.toString() }
}

export async function syncInstagramAction(): Promise<{ ok?: boolean; items?: number; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const service = createServiceClient()
  const { data } = await service.from("integration_connections").select("*")
    .eq("club_id", ctx.club.clubId).eq("provider", "instagram").maybeSingle()
  if (!data) return { error: "Instagram ещё не подключён" }
  try {
    const result = await syncInstagramConnection(data as InstagramConnection)
    revalidatePath("/integrations")
    revalidatePath("/integrations/instagram")
    return { ok: true, items: result.items }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось синхронизировать Instagram" }
  }
}

export async function disconnectInstagramAction(): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const service = createServiceClient()
  const { data } = await service.from("integration_connections").select("id, secret_enc")
    .eq("club_id", ctx.club.clubId).eq("provider", "instagram").maybeSingle()
  if (!data) return { ok: true }

  try {
    const token = decryptIntegrationSecret(data.secret_enc)
    const config = getInstagramConfig()
    await fetch(`https://graph.instagram.com/${config.version}/me/permissions?access_token=${encodeURIComponent(token)}`, {
      method: "DELETE", cache: "no-store",
    })
  } catch {
    // Local deletion still removes the credential if Meta is temporarily unavailable.
  }

  await Promise.all([
    service.from("integration_connections").delete().eq("id", data.id).eq("club_id", ctx.club.clubId),
    service.from("instagram_media").delete().eq("club_id", ctx.club.clubId),
    service.from("instagram_daily_insights").delete().eq("club_id", ctx.club.clubId),
    service.from("integration_sync_runs").delete().eq("club_id", ctx.club.clubId).eq("provider", "instagram"),
    service.from("integration_events").delete().eq("club_id", ctx.club.clubId).eq("provider", "instagram"),
  ])
  revalidatePath("/integrations")
  revalidatePath("/integrations/instagram")
  return { ok: true }
}
