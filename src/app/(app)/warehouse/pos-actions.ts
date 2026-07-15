"use server"

import { getCurrentClub } from "@/lib/club"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"

export type SaleLine = { productId: string; qty: number }
export type SaleProvider = "cash" | "card" | "transfer" | "other" | "click" | "payme"
export type SaleInput = {
  items: SaleLine[]
  clientId?: string | null
  provider: SaleProvider
  online?: boolean
}
export type SaleResult = {
  ok?: boolean; error?: string
  paymentId?: string; url?: string; qr?: string; hasTelegram?: boolean; online?: boolean
}

/**
 * Продажа товара(ов) из витрины.
 *  - offline (наличные/карта/перевод/другое): сразу проводим — платёж paid, списываем остаток, пишем движения sale.
 *  - online (Click/Payme): создаём pending-платёж с «запомненной» корзиной (pending_items) + ссылку/QR;
 *    остаток спишется в момент подтверждения оплаты (afterPaymentPaid).
 */
export async function sellProductsAction(input: SaleInput): Promise<SaleResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.warehouse.sell) return { error: "Нет прав на продажу" }
  const clubId = club.clubId

  const items = (input.items ?? []).filter((i) => i.qty > 0)
  if (!items.length) return { error: "Пустая продажа" }

  const svc = createServiceClient()
  const ids = [...new Set(items.map((i) => i.productId))]
  const [{ data: prods }, { data: invs }] = await Promise.all([
    svc.from("products").select("id, name, sell_price").eq("club_id", clubId).in("id", ids),
    svc.from("inventory").select("product_id, quantity").eq("club_id", clubId).in("product_id", ids),
  ])
  const pmap = new Map((prods ?? []).map((p) => [p.id, p]))
  const imap = new Map((invs ?? []).map((v) => [v.product_id, Number(v.quantity)]))

  const lines = items.map((i) => {
    const p = pmap.get(i.productId)
    return { productId: i.productId, qty: i.qty, name: p?.name ?? "", unitPrice: Number(p?.sell_price ?? 0), stock: imap.get(i.productId) ?? 0 }
  })
  for (const l of lines) {
    if (!pmap.get(l.productId)) return { error: "Товар не найден" }
    if (l.stock < l.qty) return { error: `Недостаточно: ${l.name} (остаток ${l.stock})` }
  }
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  if (total <= 0) return { error: "Сумма продажи равна нулю" }

  const online = !!input.online && (input.provider === "click" || input.provider === "payme")

  // ── Онлайн: pending + ссылка/QR, без списания ──
  if (online) {
    const { data: cred } = await svc.from("club_payment_credentials")
      .select("enabled").eq("club_id", clubId).eq("provider", input.provider).maybeSingle()
    if (!cred?.enabled) return { error: `${input.provider === "click" ? "Click" : "Payme"} не подключён` }

    const pendingItems = lines.map((l) => ({ product_id: l.productId, qty: l.qty, unit_price: l.unitPrice, name: l.name }))
    const { data: pay, error } = await svc.from("payments").insert({
      club_id: clubId, client_id: input.clientId ?? null, amount: total,
      provider: input.provider, status: "pending", pending_items: pendingItems,
    }).select("id").single()
    if (error || !pay) return { error: error?.message ?? "Ошибка создания платежа" }

    const { buildClickPayUrl, buildPaymePayUrl } = await import("@/lib/payment-links")
    const url = input.provider === "click"
      ? await buildClickPayUrl(clubId, pay.id, total)
      : await buildPaymePayUrl(clubId, pay.id, total)
    if (!url) return { error: "Не удалось сформировать ссылку" }

    let qr: string | undefined
    try { const QR = (await import("qrcode")).default; qr = await QR.toDataURL(url, { margin: 1, width: 240 }) } catch { /* без QR */ }

    let hasTelegram = false
    if (input.clientId) {
      const { data: cl } = await svc.from("clients").select("telegram_id").eq("id", input.clientId).maybeSingle()
      hasTelegram = !!cl?.telegram_id
    }
    revalidatePath("/warehouse")
    return { ok: true, online: true, paymentId: pay.id, url, qr, hasTelegram }
  }

  // ── Offline: проводим сразу ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pay, error: pe } = await svc.from("payments").insert({
    club_id: clubId, client_id: input.clientId ?? null, amount: total,
    provider: input.provider, status: "paid", paid_at: new Date().toISOString(),
  }).select("id").single()
  if (pe || !pay) return { error: pe?.message ?? "Ошибка платежа" }

  for (const l of lines) {
    const { data: ok } = await svc.rpc("decrement_inventory", { p_product_id: l.productId, p_qty: l.qty, p_club_id: clubId })
    if (ok === false) return { error: `Остаток изменился: ${l.name}. Обновите витрину.` }
    await svc.from("stock_movements").insert({
      club_id: clubId, product_id: l.productId, type: "sale", qty: l.qty, unit_price: l.unitPrice,
      client_id: input.clientId ?? null, payment_id: pay.id, created_by: user?.id ?? null,
    })
  }
  revalidatePath("/warehouse")
  revalidatePath("/payments")
  return { ok: true, online: false, paymentId: pay.id }
}

/** Статус платежа онлайн-продажи (для авто-обновления экрана без перезагрузки). */
export async function getSaleStatusAction(paymentId: string): Promise<{ status?: string }> {
  const club = await getCurrentClub()
  if (!club) return {}
  const { data } = await createServiceClient().from("payments")
    .select("status").eq("id", paymentId).eq("club_id", club.clubId).maybeSingle()
  return { status: data?.status }
}

export async function searchClientsPosAction(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  return searchClientsForCheckin(supabase, query, club.clubId)
}

/** Сохранить фото/штрихкод/описание товара (после загрузки фото в Storage на клиенте). */
export async function updateProductDetailsAction(
  productId: string, patch: { photoUrl?: string | null; barcode?: string | null; description?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.warehouse.view) return { error: "Нет прав" }
  const upd: Record<string, unknown> = {}
  if (patch.photoUrl !== undefined) upd.photo_url = patch.photoUrl
  if (patch.barcode !== undefined) upd.barcode = patch.barcode || null
  if (patch.description !== undefined) upd.description = patch.description || null
  if (!Object.keys(upd).length) return { ok: true }
  const { error } = await createServiceClient().from("products")
    .update(upd).eq("id", productId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/warehouse")
  return { ok: true }
}
