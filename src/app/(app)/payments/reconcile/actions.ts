"use server"

import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"
import { confirmMatch, ignoreTxn, runMatching, getReconciliationRows, type ReconRow } from "@/lib/reconcile"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"
import { createClient } from "@/lib/supabase/server"

export async function confirmReconAction(txnId: string, paymentId: string): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.payments.create) return { error: "Нет прав" }
  const r = await confirmMatch(club.clubId, txnId, paymentId)
  revalidatePath("/payments/reconcile")
  revalidatePath("/payments")
  return r
}

export async function ignoreReconAction(txnId: string): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.payments.create) return { error: "Нет прав" }
  const r = await ignoreTxn(club.clubId, txnId)
  revalidatePath("/payments/reconcile")
  return r
}

export async function rematchReconAction(): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  await runMatching(club.clubId)
  revalidatePath("/payments/reconcile")
  return { ok: true }
}

export async function refreshReconAction(): Promise<ReconRow[]> {
  const club = await getCurrentClub()
  if (!club) return []
  return getReconciliationRows(club.clubId)
}

export async function searchClientsReconAction(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  return searchClientsForCheckin(supabase, query, club.clubId)
}

/** Ручная привязка нераспознанного поступления к клиенту: создаём оплаченный платёж + отпечаток карты. */
export async function manualAttachAction(txnId: string, clientId: string): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.payments.create) return { error: "Нет прав" }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const s = createServiceClient()
  const { data: tx } = await s.from("acquiring_transactions")
    .select("id, provider, amount, paid_at, card_mask, match_status").eq("id", txnId).eq("club_id", club.clubId).maybeSingle()
  if (!tx) return { error: "Транзакция не найдена" }
  if (tx.match_status === "confirmed") return { error: "Уже привязана" }

  const { data: pay, error } = await s.from("payments").insert({
    club_id: club.clubId, client_id: clientId, amount: tx.amount, provider: tx.provider,
    status: "paid", paid_at: tx.paid_at, tx_id: tx.id,
  }).select("id").single()
  if (error || !pay) return { error: error?.message ?? "Ошибка создания платежа" }

  await s.from("acquiring_transactions").update({
    match_status: "confirmed", matched_payment_id: pay.id, matched_at: new Date().toISOString(),
  }).eq("id", txnId)

  if (tx.card_mask) {
    await s.from("client_card_fingerprints").upsert(
      { club_id: club.clubId, client_id: clientId, card_mask: tx.card_mask, last_seen_at: new Date().toISOString() },
      { onConflict: "club_id,card_mask" },
    )
  }
  revalidatePath("/payments/reconcile")
  revalidatePath("/payments")
  return { ok: true }
}
