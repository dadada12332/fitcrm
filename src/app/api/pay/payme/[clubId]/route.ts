import { NextRequest, NextResponse } from "next/server"
import { getClubCredentials } from "@/lib/club-credentials"
import { createServiceClient } from "@/lib/supabase/service"
import { afterPaymentPaid } from "@/lib/payment-confirm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Коды ошибок Payme Merchant API
const PE = {
  AUTH: -32504, METHOD: -32601, PARSE: -32700,
  AMOUNT: -31001, TX_NOT_FOUND: -31003, CANT_PERFORM: -31008, ACCOUNT: -31050,
}
const msg = (ru: string) => ({ ru, uz: ru, en: ru })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ok(id: any, result: any) { return NextResponse.json({ jsonrpc: "2.0", id, result }) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function err(id: any, code: number, message: string, data?: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message: msg(message), ...(data ? { data } : {}) } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const creds = await getClubCredentials(clubId, "payme")

  // ── Basic auth: Paycom:KEY ──
  const auth = req.headers.get("authorization") ?? ""
  const okAuth = (k: string | undefined) => !!k && auth === "Basic " + Buffer.from("Paycom:" + k).toString("base64")
  if (!creds || (!okAuth(creds.key) && !okAuth(creds.test_key))) {
    return err(null, PE.AUTH, "Недостаточно привилегий")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return err(null, PE.PARSE, "Ошибка разбора JSON") }
  const { id, method, params: prm } = body ?? {}
  const service = createServiceClient()
  const accountField = creds.account_field || "order_id"
  const now = Date.now()

  // Находит платёж по account и проверяет сумму. Возвращает {payment} или {code,message}.
  async function resolvePayment(): Promise<{ payment?: { id: string; amount: number; status: string }; code?: number; message?: string }> {
    const paymentId = prm?.account?.[accountField]
    if (!paymentId) return { code: PE.ACCOUNT, message: "Неверный идентификатор заказа" }
    const { data: payment } = await service.from("payments").select("id, amount, status").eq("id", paymentId).eq("club_id", clubId).maybeSingle()
    if (!payment) return { code: PE.ACCOUNT, message: "Заказ не найден" }
    return { payment }
  }
  function checkAmount(paymentAmountSum: number): boolean {
    return Number(prm?.amount) === Math.round(paymentAmountSum * 100)
  }

  switch (method) {
    case "CheckPerformTransaction": {
      const r = await resolvePayment()
      if (r.code) return err(id, r.code, r.message!)
      if (!checkAmount(r.payment!.amount)) return err(id, PE.AMOUNT, "Неверная сумма")
      if (r.payment!.status === "paid") return err(id, PE.CANT_PERFORM, "Заказ уже оплачен")
      return ok(id, { allow: true })
    }

    case "CreateTransaction": {
      const txId = String(prm?.id ?? "")
      const { data: existing } = await service.from("payme_transactions").select("*").eq("id", txId).maybeSingle()
      if (existing) {
        if (existing.state === 1) return ok(id, { create_time: Number(existing.create_time), transaction: existing.id, state: 1 })
        return err(id, PE.CANT_PERFORM, "Транзакция в недопустимом состоянии")
      }
      const r = await resolvePayment()
      if (r.code) return err(id, r.code, r.message!)
      if (!checkAmount(r.payment!.amount)) return err(id, PE.AMOUNT, "Неверная сумма")
      if (r.payment!.status === "paid") return err(id, PE.CANT_PERFORM, "Заказ уже оплачен")
      // Другая активная транзакция на этот платёж?
      const { data: active } = await service.from("payme_transactions").select("id").eq("payment_id", r.payment!.id).in("state", [1, 2]).neq("id", txId).limit(1).maybeSingle()
      if (active) return err(id, PE.ACCOUNT, "Заказ уже обрабатывается")

      const createTime = Number(prm?.time) || now
      await service.from("payme_transactions").insert({
        id: txId, club_id: clubId, payment_id: r.payment!.id, amount: Number(prm?.amount) || 0, state: 1, create_time: createTime,
      })
      await service.from("payments").update({ provider: "payme" }).eq("id", r.payment!.id)
      return ok(id, { create_time: createTime, transaction: txId, state: 1 })
    }

    case "PerformTransaction": {
      const txId = String(prm?.id ?? "")
      const { data: tx } = await service.from("payme_transactions").select("*").eq("id", txId).maybeSingle()
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      if (tx.state === 2) return ok(id, { transaction: tx.id, perform_time: Number(tx.perform_time), state: 2 })
      if (tx.state !== 1) return err(id, PE.CANT_PERFORM, "Транзакция в недопустимом состоянии")
      const performTime = now
      await service.from("payme_transactions").update({ state: 2, perform_time: performTime }).eq("id", txId)
      if (tx.payment_id) {
        await service.from("payments").update({ status: "paid", paid_at: new Date().toISOString(), provider: "payme", tx_id: txId }).eq("id", tx.payment_id)
        await afterPaymentPaid(clubId, tx.payment_id)   // активация абонемента + чек в Telegram
      }
      return ok(id, { transaction: txId, perform_time: performTime, state: 2 })
    }

    case "CancelTransaction": {
      const txId = String(prm?.id ?? "")
      const reason = prm?.reason ?? null
      const { data: tx } = await service.from("payme_transactions").select("*").eq("id", txId).maybeSingle()
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      if (tx.state < 0) return ok(id, { transaction: tx.id, cancel_time: Number(tx.cancel_time), state: tx.state })
      const cancelTime = now
      const newState = tx.state === 2 ? -2 : -1
      await service.from("payme_transactions").update({ state: newState, cancel_time: cancelTime, reason }).eq("id", txId)
      // Отмена после проведения — возвращаем платёж в неоплаченный (refunded).
      if (tx.state === 2 && tx.payment_id) await service.from("payments").update({ status: "refunded" }).eq("id", tx.payment_id)
      return ok(id, { transaction: txId, cancel_time: cancelTime, state: newState })
    }

    case "CheckTransaction": {
      const txId = String(prm?.id ?? "")
      const { data: tx } = await service.from("payme_transactions").select("*").eq("id", txId).maybeSingle()
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      return ok(id, {
        create_time: Number(tx.create_time), perform_time: Number(tx.perform_time), cancel_time: Number(tx.cancel_time),
        transaction: tx.id, state: tx.state, reason: tx.reason ?? null,
      })
    }

    case "GetStatement": {
      const from = Number(prm?.from) || 0
      const to = Number(prm?.to) || now
      const { data: txs } = await service.from("payme_transactions").select("*").eq("club_id", clubId).gte("create_time", from).lte("create_time", to)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transactions = (txs ?? []).map((t: any) => ({
        id: t.id, time: Number(t.create_time), amount: Number(t.amount),
        account: { [accountField]: t.payment_id }, create_time: Number(t.create_time),
        perform_time: Number(t.perform_time), cancel_time: Number(t.cancel_time),
        transaction: t.id, state: t.state, reason: t.reason ?? null,
      }))
      return ok(id, { transactions })
    }

    default:
      return err(id, PE.METHOD, "Метод не найден")
  }
}
