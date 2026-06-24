import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

// Standard Webhooks signature verification
// Secret format: "v1,whsec_<base64>"
function verifySignature(payload: string, header: string, secret: string): boolean {
  try {
    // Extract base64 key from "v1,whsec_<base64>"
    const b64 = secret.replace(/^v1,whsec_/, "")
    const key = Buffer.from(b64, "base64")

    // Header format: "v1=<hex_sig>,v1=..." or "v1=<hex_sig>"
    const signatures = header.split(" ").filter(s => s.startsWith("v1=")).map(s => s.slice(3))
    if (!signatures.length) return false

    const expected = createHmac("sha256", key).update(payload).digest("hex")
    return signatures.some(sig => {
      try {
        return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID     = process.env.TELEGRAM_CHAT_ID
  const HOOK_SECRET = process.env.SUPABASE_HOOK_SECRET

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ error: "Telegram env vars not set" }, { status: 500 })
  }

  const rawBody = await req.text()

  // Проверяем подпись если секрет задан
  if (HOOK_SECRET) {
    const sigHeader = req.headers.get("webhook-signature") ?? req.headers.get("x-supabase-signature") ?? ""
    if (!verifySignature(rawBody, sigHeader, HOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let body: { phone?: string; otp?: string }
  try {
    body = JSON.parse(rawBody)
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
    console.error("Telegram error:", await tgRes.text())
    return NextResponse.json({ error: "Telegram send failed" }, { status: 502 })
  }

  return NextResponse.json({})
}
