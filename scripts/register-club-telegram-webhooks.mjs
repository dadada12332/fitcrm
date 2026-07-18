// Re-registers all connected club bots after webhook routing or CRON_SECRET changes.
// Usage: node scripts/register-club-telegram-webhooks.mjs [env-file-with-CRON_SECRET]
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const source of [new URL("../.env.local", import.meta.url), process.argv[2]].filter(Boolean)) {
  readFileSync(source, "utf8").split(/\r?\n/).forEach((line) => {
    const index = line.indexOf("=")
    if (index > 0 && line.slice(index + 1).trim()) {
      env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")
    }
  })
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const cronSecret = env.CRON_SECRET
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
if (!supabaseUrl || !serviceKey || !cronSecret) {
  console.error("Supabase credentials or CRON_SECRET are missing")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
const { data: integrations, error } = await supabase.from("telegram_integrations").select("club_id, bot_token")
if (error) throw error

let registered = 0
let failed = 0
for (const integration of integrations ?? []) {
  const token = integration.bot_token
  const { data: club } = await supabase.from("clubs").select("id, settings").eq("id", integration.club_id).single()
  if (!club) { failed++; continue }
  const api = async (method, body) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return response.json()
  }
  try {
    const secret = createHmac("sha256", cronSecret).update(`${club.id}:${token}`).digest("hex")
    const [me, webhook] = await Promise.all([
      api("getMe"),
      api("setWebhook", {
        url: `${appUrl}/api/telegram/webhook/${club.id}`,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
      api("setMyCommands", { commands: [
        { command: "start", description: "Главное меню" },
        { command: "sub", description: "Мой абонемент" },
        { command: "schedule", description: "Расписание клуба" },
        { command: "qr", description: "QR-код для входа" },
        { command: "help", description: "Помощь" },
      ] }),
      api("setChatMenuButton", { menu_button: {
        type: "web_app",
        text: "Открыть кабинет",
        web_app: { url: `${appUrl}/tg/${club.id}` },
      } }),
    ])
    if (!me.ok || !webhook.ok) throw new Error("Telegram rejected bot setup")
    const settings = (club.settings && typeof club.settings === "object") ? club.settings : {}
    await supabase.from("clubs").update({ settings: {
      ...settings,
      tg_bot: {
        ...(settings.tg_bot ?? {}),
        username: me.result.username,
        firstName: me.result.first_name,
        id: me.result.id,
        webhook_registered: true,
        webhook_checked_at: new Date().toISOString(),
      },
    } }).eq("id", club.id)
    registered++
  } catch {
    failed++
  }
}

console.log(`Club bot webhooks: ${registered} registered, ${failed} failed.`)
if (failed) process.exit(1)
