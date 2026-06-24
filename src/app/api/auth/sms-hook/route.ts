import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json({ error: "Config missing" }, { status: 500 })
    }

    const text_body = await req.text()
    let body: { phone?: string; otp?: string; user?: { phone?: string }; sms?: { otp?: string } } = {}
    try { body = JSON.parse(text_body) } catch { /* ignore */ }

    // Supabase hook format: { user: { phone }, sms: { otp } }
    // Fallback to flat format for direct testing: { phone, otp }
    const phone = body.user?.phone ?? body.phone
    const otp = body.sms?.otp ?? body.otp
    if (!phone || !otp) {
      return NextResponse.json({ error: "Missing phone or otp" }, { status: 400 })
    }

    const msg = `🔐 FitCRM — код: ${otp}\nТелефон: ${phone}`

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg }),
      },
    )

    const tgData = await tgRes.json()
    if (!tgRes.ok) {
      return NextResponse.json({ error: "Telegram error", detail: tgData }, { status: 502 })
    }

    return NextResponse.json({})
  } catch (err) {
    console.error("SMS hook error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
