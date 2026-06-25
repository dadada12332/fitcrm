import { webhookCallback } from "grammy"
import { getBot } from "@/lib/telegram/bot"

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""

export async function POST(req: Request) {
  if (SECRET) {
    const token = req.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if (token !== SECRET) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  try {
    const handleUpdate = webhookCallback(getBot(), "std/http")
    return await handleUpdate(req)
  } catch (err) {
    console.error("Telegram webhook error:", err)
    return new Response("OK", { status: 200 })
  }
}
