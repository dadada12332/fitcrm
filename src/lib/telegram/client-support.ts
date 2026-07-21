import type { SupabaseClient } from "@supabase/supabase-js"
import { CLIENT_INBOX_CATEGORIES, type ClientConversationCategory } from "@/lib/client-inbox"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MiniAppSupportMessage = {
  id: string
  senderType: "client" | "staff" | "system"
  body: string
  deliveryStatus: string
  createdAt: string
}

export type MiniAppSupportConversation = {
  id: string
  conversationNo: number
  category: ClientConversationCategory
  status: "new" | "open" | "waiting_client" | "resolved" | "closed"
  lastMessageAt: string
  messages: MiniAppSupportMessage[]
}

export async function loadMiniAppSupport(
  service: SupabaseClient,
  clubId: string,
  clientId: string,
  requestedConversationId?: string,
): Promise<{ conversation: MiniAppSupportConversation | null; recent: Array<Omit<MiniAppSupportConversation, "messages">> }> {
  const { data: recentRows } = await service.from("client_conversations")
    .select("id, conversation_no, category, status, last_message_at")
    .eq("club_id", clubId).eq("client_id", clientId).eq("channel", "telegram")
    .order("last_message_at", { ascending: false }).limit(10)

  const requested = requestedConversationId && UUID.test(requestedConversationId)
    ? (recentRows ?? []).find((row) => row.id === requestedConversationId)
    : null
  const active = (recentRows ?? []).find((row) => ["new", "open", "waiting_client", "resolved"].includes(row.status))
  const selected = requested ?? active ?? recentRows?.[0] ?? null
  let messages: MiniAppSupportMessage[] = []
  if (selected) {
    const { data } = await service.from("client_conversation_messages")
      .select("id, sender_type, body, delivery_status, created_at")
      .eq("club_id", clubId).eq("conversation_id", selected.id).eq("visibility", "public")
      .order("created_at", { ascending: true }).limit(300)
    messages = (data ?? []).map((message) => ({
      id: message.id,
      senderType: message.sender_type as MiniAppSupportMessage["senderType"],
      body: message.body,
      deliveryStatus: message.delivery_status,
      createdAt: message.created_at,
    }))
  }

  return {
    conversation: selected ? {
      id: selected.id,
      conversationNo: Number(selected.conversation_no),
      category: selected.category as ClientConversationCategory,
      status: selected.status as MiniAppSupportConversation["status"],
      lastMessageAt: selected.last_message_at,
      messages,
    } : null,
    recent: (recentRows ?? []).map((row) => ({
      id: row.id,
      conversationNo: Number(row.conversation_no),
      category: row.category as ClientConversationCategory,
      status: row.status as MiniAppSupportConversation["status"],
      lastMessageAt: row.last_message_at,
    })),
  }
}

export async function sendMiniAppSupportMessage(input: {
  service: SupabaseClient
  clubId: string
  clientId: string
  telegramId: number
  body: string
  idempotencyKey?: string
  conversationId?: string
  category?: ClientConversationCategory
}): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const text = input.body.trim()
  if (!text) return { ok: false, error: "Введите сообщение" }
  if (text.length > 4000) return { ok: false, error: "Сообщение не должно превышать 4000 символов" }
  if (input.idempotencyKey && !UUID.test(input.idempotencyKey)) return { ok: false, error: "Некорректный идентификатор сообщения" }

  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count } = await input.service.from("client_conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("club_id", input.clubId).eq("sender_client_id", input.clientId).gte("created_at", minuteAgo)
  if ((count ?? 0) >= 8) return { ok: false, error: "Слишком много сообщений. Подождите минуту." }

  let conversationId = input.conversationId
  if (conversationId) {
    if (!UUID.test(conversationId)) return { ok: false, error: "Диалог не найден" }
    const { data: existing } = await input.service.from("client_conversations").select("id, status")
      .eq("id", conversationId).eq("club_id", input.clubId).eq("client_id", input.clientId).eq("channel", "telegram").maybeSingle()
    if (!existing) return { ok: false, error: "Диалог не найден" }
    if (existing.status === "closed") return { ok: false, error: "Диалог закрыт. Создайте новое обращение." }
  } else {
    const category = input.category ?? "other"
    if (!CLIENT_INBOX_CATEGORIES.some((item) => item.key === category)) return { ok: false, error: "Выберите тему обращения" }

    // Reaching this branch with a category is an explicit "new question" flow.
    // Keep the old thread in history instead of silently reopening it.
    await input.service.from("client_conversations").update({
      status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("club_id", input.clubId).eq("client_id", input.clientId).eq("channel", "telegram")
      .eq("status", "resolved")

    const { data: active } = await input.service.from("client_conversations").select("id")
      .eq("club_id", input.clubId).eq("client_id", input.clientId).eq("channel", "telegram")
      .in("status", ["new", "open", "waiting_client"]).order("last_message_at", { ascending: false }).limit(1).maybeSingle()
    conversationId = active?.id
    if (!conversationId) {
      const subject = CLIENT_INBOX_CATEGORIES.find((item) => item.key === category)?.label ?? "Другое"
      const { data: created, error } = await input.service.from("client_conversations").insert({
        club_id: input.clubId,
        client_id: input.clientId,
        channel: "telegram",
        category,
        subject,
      }).select("id").single()
      if (error || !created) {
        const { data: raced } = await input.service.from("client_conversations").select("id")
          .eq("club_id", input.clubId).eq("client_id", input.clientId).eq("channel", "telegram")
          .in("status", ["new", "open", "waiting_client"]).limit(1).maybeSingle()
        if (!raced) return { ok: false, error: "Не удалось создать обращение" }
        conversationId = raced.id
      } else conversationId = created.id
    }
  }

  const { error: messageError } = await input.service.from("client_conversation_messages").insert({
    conversation_id: conversationId,
    club_id: input.clubId,
    sender_type: "client",
    sender_client_id: input.clientId,
    body: text,
    channel: "telegram",
    idempotency_key: input.idempotencyKey ?? null,
    delivery_status: "received",
    metadata: { telegram_id: input.telegramId },
  })
  if (messageError?.code === "23505" && input.idempotencyKey) return { ok: true, conversationId }
  if (messageError) return { ok: false, error: "Не удалось отправить сообщение" }
  return { ok: true, conversationId }
}
