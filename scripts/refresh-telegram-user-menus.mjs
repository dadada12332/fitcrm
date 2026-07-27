// Refreshes Telegram commands and Web App buttons for already-linked clients and staff.
// Usage: node scripts/refresh-telegram-user-menus.mjs [env-file]
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
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://fitcrm-three.vercel.app").replace(/\/$/, "")
if (!supabaseUrl || !serviceKey) {
  console.error("Supabase credentials are missing")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
const { data: integrations, error: integrationError } = await supabase
  .from("telegram_integrations")
  .select("club_id, bot_token")
if (integrationError) throw integrationError

let botsUpdated = 0
let chatsUpdated = 0
let failed = 0

for (const integration of integrations ?? []) {
  const api = async (method, body) => {
    const response = await fetch(`https://api.telegram.org/bot${integration.bot_token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return response.json()
  }

  const defaultCommands = [
    { command: "start", description: "Главное меню" },
    { command: "menu", description: "Открыть Zalkins" },
    { command: "help", description: "Помощь" },
  ]

  try {
    const [commands, menu] = await Promise.all([
      api("setMyCommands", { commands: defaultCommands }),
      api("setChatMenuButton", { menu_button: { type: "commands" } }),
    ])
    if (!commands.ok || !menu.ok) throw new Error("Default Telegram setup failed")
    botsUpdated++
  } catch {
    failed++
    continue
  }

  const { data: links, error: linksError } = await supabase
    .from("telegram_users")
    .select("telegram_id, client_id, staff_id")
    .eq("club_id", integration.club_id)
  if (linksError) {
    failed++
    continue
  }

  for (const link of links ?? []) {
    if (!link.client_id && !link.staff_id) continue
    const isStaff = Boolean(link.staff_id)
    try {
      const [commands, menu] = await Promise.all([
        api("setMyCommands", {
          commands: [
            { command: "start", description: "Главное меню" },
            { command: "menu", description: isStaff ? "Рабочее пространство" : "Личный кабинет" },
            { command: "help", description: "Помощь" },
          ],
          scope: { type: "chat", chat_id: link.telegram_id },
        }),
        api("setChatMenuButton", {
          chat_id: link.telegram_id,
          menu_button: {
            type: "web_app",
            text: isStaff ? "Открыть Zalkins" : "Открыть кабинет",
            web_app: { url: `${appUrl}/tg/${integration.club_id}` },
          },
        }),
      ])
      if (!commands.ok || !menu.ok) throw new Error("Chat Telegram setup failed")
      chatsUpdated++
    } catch {
      failed++
    }
  }
}

console.log(`Telegram menus: ${botsUpdated} bots, ${chatsUpdated} linked chats, ${failed} failed.`)
if (failed) process.exit(1)
