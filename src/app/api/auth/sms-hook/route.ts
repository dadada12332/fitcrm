import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
    return NextResponse.json({ error: "Config missing" }, { status: 500 })
  }

  let body: { phone?: string; otp?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { phone, otp } = body
  if (!phone || !otp) {
    return NextResponse.json({ error: "Missing phone or otp" }, { status: 400 })
  }

  const text = `🔐 *FitCRM — код подтверждения*\n\nТелефон: \`${phone}\`\nКод: *${otp}*\n\n_Действителен 5 минут_`

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: Number(CHAT_ID), text, parse_mode: "Markdown" }),
  })

  if (!tgRes.ok) {
    const err = await tgRes.text()
    console.error("Telegram error:", err)
    return NextResponse.json({ error: "Telegram send failed" }, { status: 502 })
  }

  return NextResponse.json({})
}
