import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

export async function POST(req: NextRequest) {
  const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID     = process.env.TELEGRAM_CHAT_ID
  const HOOK_SECRET = process.env.SUPABASE_HOOK_SECRET

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ error: "Telegram env vars not set" }, { status: 500 })
  }

  // Проверяем подпись Supabase
  if (HOOK_SECRET) {
    const signature = req.headers.get("x-supabase-signature") ?? ""
    const rawBody   = await req.text()

    const expected = createHmac("sha256", HOOK_SECRET).update(rawBody).digest("hex")
    try {
      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as { phone?: string; otp?: string }
    return sendToTelegram(body.phone, body.otp, BOT_TOKEN, CHAT_ID)
  }

  // Без секрета (локальный дев)
  const body = await req.json() as { phone?: string; otp?: string }
  return sendToTelegram(body.phone, body.otp, BOT_TOKEN, CHAT_ID)
}

async function sendToTelegram(
  phone: string | undefined,
  otp: string | undefined,
  token: string,
  chatId: string,
) {
  if (!phone || !otp) {
    return NextResponse.json({ error: "Missing phone or otp" }, { status: 400 })
  }

  const text = `🔐 *FitCRM — код подтверждения*\n\nТелефон: \`${phone}\`\nКод: *${otp}*\n\n_Действителен 5 минут_`

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: Number(chatId), text, parse_mode: "Markdown" }),
  })

  if (!tgRes.ok) {
    console.error("Telegram error:", await tgRes.text())
    return NextResponse.json({ error: "Telegram send failed" }, { status: 502 })
  }

  return NextResponse.json({})
}
