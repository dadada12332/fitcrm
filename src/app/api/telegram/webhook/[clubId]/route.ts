import { timingSafeEqual } from "node:crypto"
import { webhookCallback } from "grammy"
import { createServiceClient } from "@/lib/supabase/service"
import { getClubBot } from "@/lib/telegram/bot"
import { getTelegramWebhookSecret } from "@/lib/telegram/api"

export const runtime = "nodejs"

function secretsMatch(received: string | null, expected: string) {
  if (!received || received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

export async function POST(req: Request, ctx: RouteContext<"/api/telegram/webhook/[clubId]">) {
  const { clubId } = await ctx.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clubId)) {
    return new Response("Not found", { status: 404 })
  }

  const { data: integration } = await createServiceClient()
    .from("telegram_integrations")
    .select("bot_token")
    .eq("club_id", clubId)
    .maybeSingle()
  const token = integration?.bot_token as string | null
  if (!token) return new Response("Not found", { status: 404 })

  let expectedSecret: string
  try {
    expectedSecret = getTelegramWebhookSecret(clubId, token)
  } catch {
    return new Response("Webhook is not configured", { status: 503 })
  }

  if (!secretsMatch(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), expectedSecret)) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    return await webhookCallback(getClubBot(token, clubId), "std/http")(req)
  } catch (error) {
    console.error("Club Telegram webhook failed", { clubId, error })
    return new Response("OK", { status: 200 })
  }
}
