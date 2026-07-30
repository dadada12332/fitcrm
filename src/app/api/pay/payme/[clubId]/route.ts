import { NextRequest, NextResponse } from "next/server"
import { getClubCredentials } from "@/lib/club-credentials"
import { createServiceClient } from "@/lib/supabase/service"
import { sendPaymentReceipt, type PaymentConfirmation } from "@/lib/payment-confirm"

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
    const { data: payment, error: paymentError } = await service.from("payments").select("id, amount, status").eq("id", paymentId).eq("club_id", clubId).maybeSingle()
    if (paymentError) return { code: PE.CANT_PERFORM, message: "Временная ошибка базы данных" }
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
      const { data: existing, error: existingError } = await service.from("payme_transactions").select("*").eq("id", txId).eq("club_id", clubId).maybeSingle()
      if (existingError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      if (existing) {
        if (existing.state === 1) return ok(id, { create_time: Number(existing.create_time), transaction: existing.id, state: 1 })
        return err(id, PE.CANT_PERFORM, "Транзакция в недопустимом состоянии")
      }
      const r = await resolvePayment()
      if (r.code) return err(id, r.code, r.message!)
      if (!checkAmount(r.payment!.amount)) return err(id, PE.AMOUNT, "Неверная сумма")
      if (r.payment!.status === "paid") return err(id, PE.CANT_PERFORM, "Заказ уже оплачен")
      const createTime = Number(prm?.time) || now
      const { data: created, error: createError } = await service.rpc("create_payme_transaction", {
        p_club_id: clubId,
        p_payment_id: r.payment!.id,
        p_tx_id: txId,
        p_amount: Number(prm?.amount) || 0,
        p_create_time: createTime,
      })
      if (createError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      const result = created as { create_time?: number; transaction?: string; state?: number } | null
      if (result?.state !== 1) return err(id, PE.CANT_PERFORM, "Транзакция в недопустимом состоянии")
      return ok(id, {
        create_time: Number(result.create_time ?? createTime),
        transaction: result.transaction ?? txId,
        state: 1,
      })
    }

    case "PerformTransaction": {
      const txId = String(prm?.id ?? "")
      const { data: tx, error: txError } = await service.from("payme_transactions").select("*").eq("id", txId).eq("club_id", clubId).maybeSingle()
      if (txError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      if (tx.state === 2) return ok(id, { transaction: tx.id, perform_time: Number(tx.perform_time), state: 2 })
      if (tx.state !== 1) return err(id, PE.CANT_PERFORM, "Транзакция в недопустимом состоянии")
      const performTime = now
      const { data: confirmation, error: performError } = await service.rpc("perform_payme_transaction", {
        p_club_id: clubId,
        p_tx_id: txId,
        p_perform_time: performTime,
      })
      if (performError) return err(id, PE.CANT_PERFORM, "Временная ошибка подтверждения оплаты")
      await sendPaymentReceipt(clubId, (confirmation as PaymentConfirmation | null) ?? {})
      return ok(id, { transaction: txId, perform_time: performTime, state: 2 })
    }

    case "CancelTransaction": {
      const txId = String(prm?.id ?? "")
      const reason = prm?.reason ?? null
      const { data: tx, error: txError } = await service.from("payme_transactions").select("*").eq("id", txId).eq("club_id", clubId).maybeSingle()
      if (txError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      if (tx.state < 0) return ok(id, { transaction: tx.id, cancel_time: Number(tx.cancel_time), state: tx.state })
      const cancelTime = now
      const { data: cancelled, error: cancelError } = await service.rpc("cancel_payme_transaction", {
        p_club_id: clubId,
        p_tx_id: txId,
        p_cancel_time: cancelTime,
        p_reason: reason,
      })
      if (cancelError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      const result = cancelled as { transaction?: string; cancel_time?: number; state?: number } | null
      return ok(id, {
        transaction: result?.transaction ?? txId,
        cancel_time: Number(result?.cancel_time ?? cancelTime),
        state: result?.state ?? (tx.state === 2 ? -2 : -1),
      })
    }

    case "CheckTransaction": {
      const txId = String(prm?.id ?? "")
      const { data: tx, error: txError } = await service.from("payme_transactions").select("*").eq("id", txId).eq("club_id", clubId).maybeSingle()
      if (txError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
      if (!tx) return err(id, PE.TX_NOT_FOUND, "Транзакция не найдена")
      return ok(id, {
        create_time: Number(tx.create_time), perform_time: Number(tx.perform_time), cancel_time: Number(tx.cancel_time),
        transaction: tx.id, state: tx.state, reason: tx.reason ?? null,
      })
    }

    case "GetStatement": {
      const from = Number(prm?.from) || 0
      const to = Number(prm?.to) || now
      const { data: txs, error: statementError } = await service.from("payme_transactions").select("*").eq("club_id", clubId).gte("create_time", from).lte("create_time", to)
      if (statementError) return err(id, PE.CANT_PERFORM, "Временная ошибка базы данных")
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
