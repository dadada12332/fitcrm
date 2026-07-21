import { createHmac } from "node:crypto"

type TelegramResponse<T = unknown> = {
  ok: boolean
  result?: T
  description?: string
}

export function getTelegramWebhookSecret(clubId: string, token: string): string {
  const serverSecret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET
  if (!serverSecret) throw new Error("Telegram webhook secret is not configured")
  return createHmac("sha256", serverSecret).update(`${clubId}:${token}`).digest("hex")
}

export function getTelegramWebhookUrl(clubId: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const origin = configured || (vercelHost ? `https://${vercelHost}` : "")
  if (!origin) throw new Error("Public application URL is not configured")
  return `${origin}/api/telegram/webhook/${clubId}`
}

export function getTelegramMiniAppUrl(clubId: string, tab?: "pass" | "support", conversationId?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const origin = configured || (vercelHost ? `https://${vercelHost}` : "")
  if (!origin) throw new Error("Public application URL is not configured")
  const url = `${origin}/tg/${clubId}`
  if (!tab) return url
  const params = new URLSearchParams({ tab })
  if (conversationId) params.set("conversation", conversationId)
  return `${url}?${params.toString()}`
}

export async function callTelegramApi<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramResponse<T>> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  return response.json() as Promise<TelegramResponse<T>>
}

export async function registerClubTelegramBot(token: string, clubId: string) {
  const webhookUrl = getTelegramWebhookUrl(clubId)
  const miniAppUrl = getTelegramMiniAppUrl(clubId)
  const secretToken = getTelegramWebhookSecret(clubId, token)
  const [webhook, commands, menu, description] = await Promise.all([
    callTelegramApi(token, "setWebhook", {
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
    callTelegramApi(token, "setMyCommands", {
      commands: [
        { command: "start", description: "Главное меню" },
        { command: "sub", description: "Мой абонемент" },
        { command: "schedule", description: "Расписание клуба" },
        { command: "qr", description: "QR-код для входа" },
        { command: "help", description: "Помощь" },
      ],
    }),
    callTelegramApi(token, "setChatMenuButton", {
      menu_button: { type: "web_app", text: "Открыть кабинет", web_app: { url: miniAppUrl } },
    }),
    callTelegramApi(token, "setMyDescription", {
      description: "Личный кабинет вашего фитнес-клуба: абонемент, расписание, посещения, QR-код и уведомления.",
    }),
  ])

  if (!webhook.ok) throw new Error(webhook.description || "Telegram не принял webhook")
  return { webhookUrl, commandsOk: commands.ok, menuOk: menu.ok, descriptionOk: description.ok }
}
