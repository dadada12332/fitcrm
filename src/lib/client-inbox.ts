import { createServiceClient } from "@/lib/supabase/service"
import { callTelegramApi, getTelegramMiniAppUrl } from "@/lib/telegram/api"

export const CLIENT_INBOX_CATEGORIES = [
  { key: "membership", label: "Абонемент" },
  { key: "payment", label: "Оплата" },
  { key: "schedule", label: "Расписание" },
  { key: "freeze", label: "Заморозка" },
  { key: "visit_qr", label: "Посещение и QR" },
  { key: "other", label: "Другое" },
] as const

export type ClientConversationCategory = typeof CLIENT_INBOX_CATEGORIES[number]["key"]
export type ClientConversationStatus = "new" | "open" | "waiting_client" | "resolved" | "closed"
export type ClientConversationPriority = "low" | "normal" | "high" | "urgent"

export const BUILTIN_CLIENT_REPLIES = [
  { id: "builtin:details", title: "Уточнить детали", category: "other" as const, body: "{client_name}, здравствуйте! Уточните, пожалуйста, детали вашего вопроса, и мы поможем." },
  { id: "builtin:schedule", title: "Расписание", category: "schedule" as const, body: "{client_name}, актуальное расписание доступно в разделе «Занятия» Mini App. Если нужного занятия нет, напишите его название и удобное время." },
  { id: "builtin:membership", title: "Абонемент", category: "membership" as const, body: "{client_name}, ваш текущий абонемент — {membership_name}, действует до {expires_at}. Что именно нужно уточнить?" },
  { id: "builtin:freeze", title: "Заморозка", category: "freeze" as const, body: "{client_name}, проверим возможность заморозки вашего абонемента. Напишите желаемые даты начала и окончания." },
  { id: "builtin:payment", title: "Оплата", category: "payment" as const, body: "{client_name}, уточните, пожалуйста, способ и примерное время оплаты. Мы проверим платёж." },
  { id: "builtin:handoff", title: "Передали специалисту", category: "other" as const, body: "{client_name}, передали ваш вопрос ответственному сотруднику. Вернёмся с ответом в этом диалоге." },
  { id: "builtin:resolved", title: "Вопрос решён?", category: "other" as const, body: "{client_name}, получилось решить вопрос? Если всё в порядке, мы закроем обращение." },
]

type TelegramMessageResult = { message_id: number }

export async function deliverClientConversationMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceClient()
  const { data: message } = await service
    .from("client_conversation_messages")
    .select("id, conversation_id, club_id, body, delivery_attempts, sender_type")
    .eq("id", messageId)
    .maybeSingle()

  if (!message || message.sender_type !== "staff") return { ok: false, error: "Сообщение не найдено" }

  const { data: conversation } = await service
    .from("client_conversations")
    .select("client_id")
    .eq("id", message.conversation_id)
    .eq("club_id", message.club_id)
    .maybeSingle()
  if (!conversation) return markDeliveryFailure(message, "Диалог не найден")

  const [{ data: integration }, { data: telegramUser }] = await Promise.all([
    service.from("telegram_integrations").select("bot_token").eq("club_id", message.club_id).maybeSingle(),
    service.from("telegram_users").select("telegram_id").eq("club_id", message.club_id)
      .eq("client_id", conversation.client_id).eq("role", "client").maybeSingle(),
  ])

  if (!integration?.bot_token) return markDeliveryFailure(message, "Telegram-бот клуба не подключён")
  if (!telegramUser?.telegram_id) return markDeliveryFailure(message, "Telegram клиента не привязан")

  try {
    const response = await callTelegramApi<TelegramMessageResult>(integration.bot_token, "sendMessage", {
      chat_id: telegramUser.telegram_id,
      text: message.body,
      reply_markup: {
        inline_keyboard: [[{
          text: "Открыть диалог",
          web_app: { url: getTelegramMiniAppUrl(message.club_id, "support", message.conversation_id) },
        }]],
      },
    })
    if (!response.ok || !response.result) {
      return markDeliveryFailure(message, response.description || "Telegram не принял сообщение")
    }
    await service.from("client_conversation_messages").update({
      delivery_status: "sent",
      delivery_attempts: Number(message.delivery_attempts ?? 0) + 1,
      external_message_id: String(response.result.message_id),
      next_delivery_at: null,
      delivery_error: null,
    }).eq("id", message.id).eq("club_id", message.club_id)
    return { ok: true }
  } catch (error) {
    return markDeliveryFailure(message, error instanceof Error ? error.message : "Ошибка Telegram")
  }
}

async function markDeliveryFailure(
  message: { id: string; club_id: string; delivery_attempts: number | null },
  error: string,
): Promise<{ ok: false; error: string }> {
  const attempts = Number(message.delivery_attempts ?? 0) + 1
  const delayMinutes = [1, 5, 15, 60, 180][Math.min(attempts - 1, 4)]
  const nextDeliveryAt = attempts >= 5 ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString()
  await createServiceClient().from("client_conversation_messages").update({
    delivery_status: "failed",
    delivery_attempts: attempts,
    next_delivery_at: nextDeliveryAt,
    delivery_error: error.slice(0, 500),
  }).eq("id", message.id).eq("club_id", message.club_id)
  return { ok: false, error }
}

export async function retryPendingClientMessages(limit = 50) {
  const service = createServiceClient()
  const now = new Date().toISOString()
  const { data } = await service.from("client_conversation_messages")
    .select("id")
    .in("delivery_status", ["pending", "failed"])
    .eq("sender_type", "staff")
    .lt("delivery_attempts", 5)
    .or(`next_delivery_at.is.null,next_delivery_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit)

  let sent = 0
  let failed = 0
  for (const row of data ?? []) {
    const result = await deliverClientConversationMessage(row.id)
    if (result.ok) sent += 1
    else failed += 1
  }
  return { processed: (data ?? []).length, sent, failed }
}

