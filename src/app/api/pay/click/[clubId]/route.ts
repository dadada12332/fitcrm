import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getClubCredentials } from "@/lib/club-credentials"
import { createServiceClient } from "@/lib/supabase/service"
import { afterPaymentPaid } from "@/lib/payment-confirm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Коды ошибок Click SHOP API
const E = {
  OK: 0, SIGN: -1, AMOUNT: -2, ACTION: -3, ALREADY_PAID: -4,
  NOT_FOUND: -5, TX_NOT_FOUND: -6, BAD_REQUEST: -8, CANCELLED: -9,
}

function md5(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex")
}

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}))
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]))
  }
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const p = await parseBody(req)

  const click_trans_id = p.click_trans_id ?? ""
  const service_id = p.service_id ?? ""
  const merchant_trans_id = p.merchant_trans_id ?? ""   // = наш payment.id
  const merchant_prepare_id = p.merchant_prepare_id ?? ""
  const amount = p.amount ?? ""
  const action = p.action ?? ""
  const sign_time = p.sign_time ?? ""
  const sign_string = p.sign_string ?? ""

  const base = (mp: string) => ({ click_trans_id, merchant_trans_id, ...(action === "1" ? { merchant_confirm_id: mp } : { merchant_prepare_id: mp }) })
  const fail = (error: number, note: string, mp = "0") => NextResponse.json({ ...base(mp), error, error_note: note })

  const creds = await getClubCredentials(clubId, "click")
  if (!creds) return fail(E.SIGN, "Merchant not configured")

  // Проверка подписи (для complete в подпись входит merchant_prepare_id)
  const signBase = action === "1"
    ? click_trans_id + service_id + creds.secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time
    : click_trans_id + service_id + creds.secret_key + merchant_trans_id + amount + action + sign_time
  if (md5(signBase) !== sign_string) return fail(E.SIGN, "SIGN CHECK FAILED")

  const service = createServiceClient()
  const { data: payment } = await service.from("payments")
    .select("id, amount, status").eq("id", merchant_trans_id).eq("club_id", clubId).maybeSingle()
  if (!payment) return fail(E.NOT_FOUND, "Order not found")
  if (Math.round(Number(amount)) !== Math.round(Number(payment.amount))) return fail(E.AMOUNT, "Incorrect amount")

  // ── Prepare (action=0) ──
  if (action === "0") {
    if (payment.status === "paid") return fail(E.ALREADY_PAID, "Already paid")
    // Помечаем начало оплаты; merchant_prepare_id — стабильное число (эхо в complete, входит в подпись).
    const prepareId = String(Math.floor(Date.now() / 1000))
    await service.from("payments").update({ provider: "click", tx_id: click_trans_id }).eq("id", payment.id).eq("club_id", clubId)
    return NextResponse.json({ click_trans_id, merchant_trans_id, merchant_prepare_id: prepareId, error: E.OK, error_note: "Success" })
  }

  // ── Complete (action=1) ──
  if (action === "1") {
    // Click отменил транзакцию на своей стороне
    if (p.error && Number(p.error) < 0) return fail(E.CANCELLED, "Transaction cancelled", merchant_prepare_id)
    if (payment.status === "paid") return fail(E.ALREADY_PAID, "Already paid", merchant_prepare_id)
    await service.from("payments").update({ status: "paid", paid_at: new Date().toISOString(), provider: "click", tx_id: click_trans_id }).eq("id", payment.id).eq("club_id", clubId)
    await afterPaymentPaid(clubId, payment.id)   // активация абонемента + чек в Telegram
    return NextResponse.json({ click_trans_id, merchant_trans_id, merchant_confirm_id: merchant_prepare_id, error: E.OK, error_note: "Success" })
  }

  return fail(E.ACTION, "Action not found")
}
