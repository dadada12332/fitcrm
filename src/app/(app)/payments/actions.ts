"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"
import { getPaymentsPage, type PaymentsQuery, type PaymentRow } from "@/lib/payments"
import { can } from "@/lib/permissions"
import { serializeCSV } from "@/lib/csv"
import { consumeMonthlyLimit } from "@/lib/plan-enforcement"
import { createServiceClient } from "@/lib/supabase/service"

const PROVIDER_RU: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
const STATUS_RU: Record<string, string> = { paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат" }

function paymentsToCSV(rows: PaymentRow[]): string {
  const header = ["Клиент", "Телефон", "Услуга", "Сумма", "Метод", "Статус", "Дата"]
  return serializeCSV(header, rows.map((r) => [
    r.clientName ?? "", r.clientPhone ?? "", r.serviceName ?? "", r.amount,
    PROVIDER_RU[r.provider] ?? r.provider, STATUS_RU[r.status] ?? r.status,
    (r.paidAt ?? r.createdAt)?.slice(0, 10) ?? "",
  ]))
}

/** Экспорт ВСЕХ платежей с учётом фильтров (батчами по 1000 — обход лимита RPC). */
export async function exportPaymentsCsvAction(q: PaymentsQuery): Promise<{ csv?: string; error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "export")) return { error: "Недостаточно прав" }
  if (!club.permissions.payments.view) return { error: "Нет прав" }
  const usageError = await consumeMonthlyLimit(club, "exports")
  if (usageError) return { error: usageError }
  const all: PaymentRow[] = []
  let page = 0
  while (page < 500) {
    const res = await getPaymentsPage(supabase, club.clubId, { ...q, page, pageSize: 1000 })
    all.push(...res.rows)
    if (res.rows.length < 1000 || all.length >= res.total) break
    page++
  }
  return { csv: paymentsToCSV(all) }
}

export type CreatePaymentInput = {
  clientId: string
  membershipId: string | null
  amount: number
  provider: "cash" | "click" | "payme" | "uzum"
  comment?: string
}

export type CreatePaymentResult = { ok?: boolean; error?: string }

export async function createPaymentAction(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: "Введите корректную сумму" }
  if (!["cash", "click", "payme", "uzum"].includes(input.provider)) return { error: "Выберите способ оплаты" }
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "create")) return { error: "Недостаточно прав" }
  const clubId = club.clubId

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("club_id", clubId)
    .maybeSingle()
  if (!client) return { error: "Клиент не найден" }
  if (input.membershipId && !can(club.permissions, "memberships", "sell")) {
    if (!can(club.permissions, "clients", "extend")) return { error: "Нет прав на продажу абонемента" }
    const { data: previous } = await supabase.from("subscriptions").select("id")
      .eq("club_id", clubId).eq("client_id", input.clientId)
      .eq("membership_id", input.membershipId).limit(1).maybeSingle()
    if (!previous) return { error: "Можно только продлить существующий абонемент" }
  }

  if (input.membershipId) {
    const { data: m } = await supabase
      .from("memberships")
      .select("id")
      .eq("id", input.membershipId)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .maybeSingle()
    if (!m) return { error: "Абонемент не найден" }
  }

  const { error } = await supabase.rpc("create_manual_payment", {
    p_club_id: clubId,
    p_client_id: input.clientId,
    p_membership_id: input.membershipId,
    p_amount: input.amount,
    p_provider: input.provider,
    p_comment: input.comment?.trim() || null,
  })
  if (error) return { error: "Не удалось сохранить оплату. Обновите страницу и повторите." }

  revalidatePath("/payments")
  revalidatePath("/dashboard")
  revalidatePath(`/clients/${input.clientId}`)
  return { ok: true }
}

export type OnlinePaymentInput = { clientId: string; membershipId: string | null; amount: number; provider: "click" | "payme" }
export type OnlinePaymentResult = { ok?: boolean; error?: string; paymentId?: string; url?: string; qr?: string; hasTelegram?: boolean }

/** Онлайн-оплата: создаёт подписку (если абонемент) + pending-платёж + ссылку оплаты и QR. */
export async function createOnlinePaymentAction(input: OnlinePaymentInput): Promise<OnlinePaymentResult> {
  if (input.provider !== "click" && input.provider !== "payme") return { error: "Неверный провайдер" }
  if (!input.amount || input.amount <= 0) return { error: "Введите сумму" }
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "create")) return { error: "Недостаточно прав" }

  const [{ data: client }, membershipResult] = await Promise.all([
    supabase.from("clients").select("id").eq("id", input.clientId).eq("club_id", club.clubId).maybeSingle(),
    input.membershipId
      ? supabase.from("memberships").select("id, price").eq("id", input.membershipId).eq("club_id", club.clubId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!client) return { error: "Клиент не найден" }
  if (input.membershipId && !membershipResult.data) return { error: "Абонемент не найден" }
  if (input.membershipId && !can(club.permissions, "memberships", "sell")) {
    if (!can(club.permissions, "clients", "extend")) return { error: "Нет прав на продажу абонемента" }
    const { data: previous } = await supabase.from("subscriptions").select("id")
      .eq("club_id", club.clubId).eq("client_id", input.clientId)
      .eq("membership_id", input.membershipId).limit(1).maybeSingle()
    if (!previous) return { error: "Можно только продлить существующий абонемент" }
  }
  if (input.membershipId && Number(membershipResult.data?.price) !== input.amount) {
    return { error: "Стоимость абонемента изменилась. Обновите форму." }
  }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const svc = createServiceClient()

  // Проверяем, что приём онлайн-оплат этим провайдером подключён.
  const { data: cred } = await svc.from("club_payment_credentials")
    .select("enabled").eq("club_id", club.clubId).eq("provider", input.provider).maybeSingle()
  if (!cred?.enabled) return { error: `${input.provider === "click" ? "Click" : "Payme"} не подключён. Оставьте заявку в Настройках → Финансы.` }

  // Абонемент НЕ активируем заранее — только после подтверждения оплаты (в эндпоинте приёма).
  // Платёж «запоминает» выбранный абонемент.
  const { data: payment, error } = await svc.from("payments").insert({
    club_id: club.clubId, client_id: input.clientId, subscription_id: null,
    pending_membership_id: input.membershipId, amount: input.amount, provider: input.provider, status: "pending",
  }).select("id").single()
  if (error || !payment) return { error: error?.message ?? "Ошибка создания платежа" }

  const { buildClickPayUrl, buildPaymePayUrl } = await import("@/lib/payment-links")
  const url = input.provider === "click"
    ? await buildClickPayUrl(club.clubId, payment.id, input.amount)
    : await buildPaymePayUrl(club.clubId, payment.id, input.amount)
  if (!url) return { error: "Не удалось сформировать ссылку" }

  // QR-код ссылки (data URL).
  let qr: string | undefined
  try { const QRCode = (await import("qrcode")).default; qr = await QRCode.toDataURL(url, { margin: 1, width: 240 }) } catch { /* без QR */ }

  // Есть ли у клиента привязанный Telegram (для кнопки «отправить»).
  const { data: cl } = await svc.from("clients").select("telegram_id").eq("id", input.clientId).eq("club_id", club.clubId).maybeSingle()
  const hasTelegram = !!cl?.telegram_id

  revalidatePath("/payments")
  revalidatePath(`/clients/${input.clientId}`)
  return { ok: true, paymentId: payment.id, url, qr, hasTelegram }
}

/** Доступные методы оплаты клуба (настройки + интеграция) — для экранов оплаты. */
export async function getPaymentMethodsAction(): Promise<import("@/lib/payment-methods").PayMethod[]> {
  const club = await getCurrentClub()
  if (!club) return [{ key: "cash", label: "Наличные", available: true, online: false }]
  const { getPaymentMethods } = await import("@/lib/payment-methods")
  return getPaymentMethods(club.clubId)
}

/** Статус платежа (для авто-обновления экрана оплаты без перезагрузки). */
export async function getPaymentStatusAction(paymentId: string): Promise<{ status?: string; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "create")) return { error: "Недостаточно прав" }
  const { createServiceClient } = await import("@/lib/supabase/service")
  const { data } = await createServiceClient().from("payments").select("status").eq("id", paymentId).eq("club_id", club.clubId).maybeSingle()
  return { status: data?.status }
}

/** Отправить ссылку оплаты клиенту в Telegram-бот клуба. */
export async function sendPaymentLinkTelegramAction(clientId: string, paymentId: string): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "create")) return { error: "Недостаточно прав" }
  const { createServiceClient } = await import("@/lib/supabase/service")
  const svc = createServiceClient()
  const [{ data: cl }, { data: clubRow }, { data: payment }] = await Promise.all([
    svc.from("clients").select("telegram_id, full_name").eq("id", clientId).eq("club_id", club.clubId).maybeSingle(),
    svc.from("telegram_integrations").select("bot_token").eq("club_id", club.clubId).maybeSingle(),
    svc.from("payments").select("id, client_id, amount, provider, status")
      .eq("id", paymentId).eq("club_id", club.clubId).eq("client_id", clientId).eq("status", "pending").maybeSingle(),
  ])
  if (!cl?.telegram_id) return { error: "У клиента не привязан Telegram" }
  if (!clubRow?.bot_token) return { error: "Бот клуба не подключён" }
  if (!payment || !["click", "payme"].includes(payment.provider)) return { error: "Платёж не найден" }
  const { buildClickPayUrl, buildPaymePayUrl } = await import("@/lib/payment-links")
  const url = payment.provider === "click"
    ? await buildClickPayUrl(club.clubId, payment.id, Number(payment.amount))
    : await buildPaymePayUrl(club.clubId, payment.id, Number(payment.amount))
  if (!url) return { error: "Не удалось сформировать ссылку" }
  const text = `💳 Ссылка для оплаты:\n${url}\n\nОплатите картой — абонемент активируется автоматически.`
  const res = await fetch(`https://api.telegram.org/bot${clubRow.bot_token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: cl.telegram_id, text }),
  })
  if (!res.ok) return { error: "Не удалось отправить сообщение" }
  return { ok: true }
}

export async function searchClientsPayments(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  return searchClientsForCheckin(supabase, query, club.clubId)
}
