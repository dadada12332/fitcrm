"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"
import { getPaymentsPage, type PaymentsQuery, type PaymentRow } from "@/lib/payments"
import { can } from "@/lib/permissions"

const PROVIDER_RU: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }
const STATUS_RU: Record<string, string> = { paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат" }

function paymentsToCSV(rows: PaymentRow[]): string {
  const header = ["Клиент", "Телефон", "Услуга", "Сумма", "Метод", "Статус", "Дата"]
  const line = (r: PaymentRow) => [
    r.clientName ?? "", r.clientPhone ?? "", r.serviceName ?? "", r.amount,
    PROVIDER_RU[r.provider] ?? r.provider, STATUS_RU[r.status] ?? r.status,
    (r.paidAt ?? r.createdAt)?.slice(0, 10) ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
  return [header.join(","), ...rows.map(line)].join("\r\n")
}

/** Экспорт ВСЕХ платежей с учётом фильтров (батчами по 1000 — обход лимита RPC). */
export async function exportPaymentsCsvAction(q: PaymentsQuery): Promise<{ csv?: string; error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.payments.view) return { error: "Нет прав" }
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

  let subscriptionId: string | null = null

  // If membership selected — create subscription
  if (input.membershipId) {
    const { data: m } = await supabase
      .from("memberships")
      .select("duration_days, visits_limit")
      .eq("id", input.membershipId)
      .eq("club_id", clubId)
      .maybeSingle()

    if (!m) return { error: "Абонемент не найден" }
    const startsAt = new Date().toISOString().slice(0, 10)
    const expiresAt = new Date(Date.now() + m.duration_days * 86_400_000).toISOString().slice(0, 10)

    const { data: sub, error: subErr } = await supabase.from("subscriptions").insert({
      club_id:      clubId,
      client_id:    input.clientId,
      membership_id: input.membershipId,
      starts_at:    startsAt,
      expires_at:   expiresAt,
      visits_total: m.visits_limit ?? null,
      visits_used:  0,
      status:       "active",
    }).select("id").single()

    if (subErr) return { error: subErr.message }
    subscriptionId = sub?.id ?? null
  }

  const { error } = await supabase.from("payments").insert({
    club_id:         clubId,
    client_id:       input.clientId,
    subscription_id: subscriptionId,
    amount:          input.amount,
    provider:        input.provider,
    status:          "paid",
    paid_at:         new Date().toISOString(),
  })

  if (error) return { error: error.message }

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
      ? supabase.from("memberships").select("id").eq("id", input.membershipId).eq("club_id", club.clubId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!client) return { error: "Клиент не найден" }
  if (input.membershipId && !membershipResult.data) return { error: "Абонемент не найден" }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const svc = createServiceClient()

  // Проверяем, что приём онлайн-оплат этим провайдером подключён.
  const { data: cred } = await svc.from("club_payment_credentials")
    .select("enabled").eq("club_id", club.clubId).eq("provider", input.provider).maybeSingle()
  if (!cred?.enabled) return { error: `${input.provider === "click" ? "Click" : "Payme"} не подключён. Оставьте заявку в Настройках → Финансы.` }

  // Абонемент НЕ активируем заранее — только после подтверждения оплаты (в эндпоинте приёма).
  // Платёж «запоминает» выбранный абонемент.
  const { data: payment, error } = await supabase.from("payments").insert({
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
export async function sendPaymentLinkTelegramAction(clientId: string, url: string): Promise<{ ok?: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "payments", "create")) return { error: "Недостаточно прав" }
  const { createServiceClient } = await import("@/lib/supabase/service")
  const svc = createServiceClient()
  const [{ data: cl }, { data: clubRow }] = await Promise.all([
    svc.from("clients").select("telegram_id, full_name").eq("id", clientId).eq("club_id", club.clubId).maybeSingle(),
    svc.from("telegram_integrations").select("bot_token").eq("club_id", club.clubId).maybeSingle(),
  ])
  if (!cl?.telegram_id) return { error: "У клиента не привязан Telegram" }
  if (!clubRow?.bot_token) return { error: "Бот клуба не подключён" }
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
