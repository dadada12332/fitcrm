import { createServiceClient } from "@/lib/supabase/service"
import { afterPaymentPaid } from "@/lib/payment-confirm"

// Строка выписки эквайринга (то, что отдаёт провайдер — подставляется фетчером).
export type StatementRow = {
  externalId: string
  amount: number
  paidAt: string        // ISO
  cardMask?: string | null
  payerName?: string | null
  raw?: unknown
}

type PendingPayment = { id: string; amount: number; client_id: string | null; created_at: string }

const round = (n: number) => Math.round(Number(n))

/**
 * Загрузить строки выписки в acquiring_transactions (идемпотентно по external_id).
 * Возвращает число новых строк.
 */
export async function ingestTransactions(clubId: string, provider: "click" | "payme", rows: StatementRow[]): Promise<number> {
  if (!rows.length) return 0
  const s = createServiceClient()
  const payload = rows.map((r) => ({
    club_id: clubId, provider, external_id: String(r.externalId),
    amount: r.amount, paid_at: r.paidAt, card_mask: r.cardMask ?? null,
    payer_name: r.payerName ?? null, raw: r.raw ?? null,
  }))
  // upsert по (club_id, provider, external_id) — новые вставит, существующие не трогает (ignoreDuplicates).
  const { data } = await s.from("acquiring_transactions")
    .upsert(payload, { onConflict: "club_id,provider,external_id", ignoreDuplicates: true })
    .select("id")
  return data?.length ?? 0
}

/**
 * Пересчитать сопоставление для всех неподтверждённых транзакций клуба.
 * Оценка уверенности: сумма (точная) + близость времени + отпечаток карты.
 */
const WINDOW_MIN = 60

export async function runMatching(clubId: string): Promise<void> {
  const s = createServiceClient()

  const [{ data: txs }, { data: fps }] = await Promise.all([
    s.from("acquiring_transactions").select("id, amount, paid_at, card_mask")
      .eq("club_id", clubId).in("match_status", ["unmatched", "suggested"]).limit(1000),
    s.from("client_card_fingerprints").select("client_id, card_mask").eq("club_id", clubId),
  ])
  if (!txs?.length) return

  const cardToClient = new Map<string, string>()
  for (const f of fps ?? []) cardToClient.set(f.card_mask, f.client_id)

  for (const tx of txs) {
    const txAmt = round(tx.amount)
    const txTime = new Date(tx.paid_at).getTime()
    const knownClient = tx.card_mask ? cardToClient.get(tx.card_mask) ?? null : null

    // Кандидаты тянем точечно (по точной сумме и окну ±60 мин) — не упираемся в лимит 1000.
    const winStart = new Date(txTime - WINDOW_MIN * 60000).toISOString()
    const winEnd = new Date(txTime + WINDOW_MIN * 60000).toISOString()
    const { data: cands } = await s.from("payments")
      .select("id, amount, client_id, created_at")
      .eq("club_id", clubId).eq("status", "pending").eq("amount", txAmt)
      .gte("created_at", winStart).lte("created_at", winEnd).limit(50)

    const scored = (cands as PendingPayment[] ?? [])
      .map((p) => {
        const diffMin = Math.abs(txTime - new Date(p.created_at).getTime()) / 60000
        let score = 40 // точная сумма
        if (diffMin <= 5) score += 30
        else if (diffMin <= 15) score += 18
        else score += 8 // всё в пределах окна ±60 мин
        if (knownClient && p.client_id === knownClient) score += 25 // отпечаток карты
        return { p, score, diffMin }
      })
      .sort((a, b) => b.score - a.score)

    let update: Record<string, unknown>
    if (!scored.length) {
      update = { match_status: "unmatched", match_confidence: null, ambiguous: false, suggested_payment_id: null }
    } else {
      const best = scored[0]
      const ambiguous = scored.length > 1 && scored[1].score === best.score
      update = {
        match_status: "suggested",
        match_confidence: Math.max(0, Math.min(100, best.score)),
        ambiguous,
        suggested_payment_id: best.p.id,
      }
    }
    await s.from("acquiring_transactions").update(update).eq("id", tx.id)
  }
}

/** Строка для экрана сверки. */
export type ReconRow = {
  id: string
  provider: string
  amount: number
  paidAt: string
  cardMask: string | null
  payerName: string | null
  status: string
  confidence: number | null
  ambiguous: boolean
  suggestedPaymentId: string | null
  clientId: string | null
  clientName: string | null
  serviceName: string | null   // абонемент/назначение pending-платежа
}

export async function getReconciliationRows(clubId: string): Promise<ReconRow[]> {
  const s = createServiceClient()
  const { data: txs } = await s.from("acquiring_transactions")
    .select("id, provider, amount, paid_at, card_mask, payer_name, match_status, match_confidence, ambiguous, suggested_payment_id")
    .eq("club_id", clubId).in("match_status", ["unmatched", "suggested"])
    .order("paid_at", { ascending: false }).limit(200)
  if (!txs?.length) return []

  const payIds = txs.map((t) => t.suggested_payment_id).filter(Boolean) as string[]
  const payMap = new Map<string, { client_id: string | null; membership: string | null }>()
  if (payIds.length) {
    const { data: pays } = await s.from("payments")
      .select("id, client_id, pending_membership_id, memberships:pending_membership_id(name), clients:client_id(full_name)")
      .in("id", payIds)
    for (const p of pays ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pa = p as any
      payMap.set(pa.id, { client_id: pa.client_id, membership: pa.memberships?.name ?? null })
    }
  }
  // имя клиента — через привязанный платёж
  const clientIds = [...payMap.values()].map((v) => v.client_id).filter(Boolean) as string[]
  const nameMap = new Map<string, string>()
  if (clientIds.length) {
    const { data: cls } = await s.from("clients").select("id, full_name").in("id", clientIds)
    for (const c of cls ?? []) nameMap.set(c.id, c.full_name)
  }

  return txs.map((t) => {
    const pay = t.suggested_payment_id ? payMap.get(t.suggested_payment_id) : undefined
    const clientId = pay?.client_id ?? null
    return {
      id: t.id, provider: t.provider, amount: Number(t.amount), paidAt: t.paid_at,
      cardMask: t.card_mask, payerName: t.payer_name, status: t.match_status,
      confidence: t.match_confidence, ambiguous: t.ambiguous,
      suggestedPaymentId: t.suggested_payment_id,
      clientId, clientName: clientId ? nameMap.get(clientId) ?? null : null,
      serviceName: pay?.membership ?? null,
    }
  })
}

/**
 * Подтвердить сопоставление: помечаем платёж оплаченным, привязываем транзакцию,
 * запоминаем отпечаток карты и активируем абонемент + чек в Telegram.
 */
export async function confirmMatch(clubId: string, txnId: string, paymentId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = createServiceClient()
  const { data: tx } = await s.from("acquiring_transactions")
    .select("id, provider, amount, paid_at, card_mask, match_status").eq("id", txnId).eq("club_id", clubId).maybeSingle()
  if (!tx) return { error: "Транзакция не найдена" }
  if (tx.match_status === "confirmed") return { ok: true }

  const { data: pay } = await s.from("payments")
    .select("id, client_id, amount, status").eq("id", paymentId).eq("club_id", clubId).maybeSingle()
  if (!pay) return { error: "Платёж не найден" }
  if (round(pay.amount) !== round(tx.amount)) return { error: "Суммы не совпадают" }

  await s.from("payments").update({
    status: "paid", paid_at: tx.paid_at, provider: tx.provider, tx_id: tx.id,
  }).eq("id", paymentId)

  await s.from("acquiring_transactions").update({
    match_status: "confirmed", matched_payment_id: paymentId, matched_at: new Date().toISOString(),
  }).eq("id", txnId)

  // Запомнить отпечаток карты за клиентом — повторные оплаты будут матчиться авто.
  if (tx.card_mask && pay.client_id) {
    await s.from("client_card_fingerprints").upsert(
      { club_id: clubId, client_id: pay.client_id, card_mask: tx.card_mask, last_seen_at: new Date().toISOString() },
      { onConflict: "club_id,card_mask" },
    )
  }

  await afterPaymentPaid(clubId, paymentId) // активация абонемента + чек в Telegram
  return { ok: true }
}

/** Пометить транзакцию проигнорированной (не относится к продаже в СРМ). */
export async function ignoreTxn(clubId: string, txnId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = createServiceClient()
  const { error } = await s.from("acquiring_transactions")
    .update({ match_status: "ignored" }).eq("id", txnId).eq("club_id", clubId)
  return error ? { error: error.message } : { ok: true }
}
