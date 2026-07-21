"use server"

import { revalidatePath } from "next/cache"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import {
  CLIENT_INBOX_CATEGORIES,
  deliverClientConversationMessage,
  type ClientConversationCategory,
  type ClientConversationPriority,
  type ClientConversationStatus,
} from "@/lib/client-inbox"
import { can } from "@/lib/permissions"
import { createServiceClient } from "@/lib/supabase/service"

export type InboxConversationListItem = {
  id: string
  conversationNo: number
  clientId: string
  clientName: string
  category: ClientConversationCategory
  status: ClientConversationStatus
  priority: ClientConversationPriority
  channel: "telegram" | "instagram" | "web"
  assigneeId: string | null
  assigneeName: string | null
  preview: string
  lastMessageAt: string
  unread: boolean
}

export type InboxMessage = {
  id: string
  senderType: "client" | "staff" | "system"
  senderName: string | null
  body: string
  deliveryStatus: "received" | "pending" | "sent" | "failed" | "not_applicable"
  deliveryError: string | null
  createdAt: string
}

export type InboxConversationDetail = {
  id: string
  conversationNo: number
  category: ClientConversationCategory
  status: ClientConversationStatus
  priority: ClientConversationPriority
  channel: "telegram" | "instagram" | "web"
  assigneeId: string | null
  client: {
    id: string
    name: string
    phone: string | null
    balance: number
    debt: number
    telegramUsername: string | null
    membershipName: string | null
    membershipExpiresAt: string | null
    lastVisitAt: string | null
  }
  messages: InboxMessage[]
}

export type InboxStaff = { id: string; name: string; role: string }
export type InboxReplyTemplate = {
  id: string
  title: string
  body: string
  category: ClientConversationCategory
  shortcut: string | null
}

type InboxContext = {
  club: NonNullable<Awaited<ReturnType<typeof getCurrentClub>>>
  staffId: string
}

async function getInboxContext(action: "view" | "reply" | "assign" | "manage_templates"): Promise<InboxContext | { error: string }> {
  const [club, user] = await Promise.all([getCurrentClub(), getAuthUser()])
  if (!club || !user) return { error: "Не авторизован" }
  if (!can(club.permissions, "inbox", action)) return { error: "Недостаточно прав" }
  const { data: staff } = await createServiceClient().from("staff").select("id")
    .eq("club_id", club.clubId).eq("user_id", user.id).eq("is_active", true).maybeSingle()
  if (!staff) return { error: "Профиль сотрудника не найден" }
  return { club, staffId: staff.id }
}

function isErrorContext(context: InboxContext | { error: string }): context is { error: string } {
  return "error" in context
}

async function staffNames(clubId: string, staffIds: string[]) {
  const result = new Map<string, string>()
  if (!staffIds.length) return result
  const service = createServiceClient()
  const { data: staff } = await service.from("staff").select("id, user_id").eq("club_id", clubId).in("id", staffIds)
  const userIds = [...new Set((staff ?? []).map((row) => row.user_id).filter(Boolean))]
  if (!userIds.length) return result
  const { data: users } = await service.from("users").select("id, full_name, email").in("id", userIds)
  const usersById = new Map((users ?? []).map((user) => [user.id, user.full_name || user.email || "Сотрудник"]))
  for (const row of staff ?? []) result.set(row.id, usersById.get(row.user_id) ?? "Сотрудник")
  return result
}

export async function listInboxConversationsAction(): Promise<{ conversations: InboxConversationListItem[]; error?: string }> {
  const context = await getInboxContext("view")
  if (isErrorContext(context)) return { conversations: [], error: context.error }
  return loadInboxConversations(context)
}

async function loadInboxConversations(context: InboxContext): Promise<{ conversations: InboxConversationListItem[]; error?: string }> {
  const { data, error } = await createServiceClient().rpc("get_client_inbox_list", {
    p_club_id: context.club.clubId,
    p_staff_id: context.staffId,
  })
  if (error) return { conversations: [], error: "Не удалось загрузить обращения" }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return {
    conversations: rows.map((row) => ({
      id: String(row.id),
      conversationNo: Number(row.conversation_no),
      clientId: String(row.client_id),
      clientName: String(row.client_name ?? "Клиент"),
      category: row.category as ClientConversationCategory,
      status: row.status as ClientConversationStatus,
      priority: row.priority as ClientConversationPriority,
      channel: row.channel as InboxConversationListItem["channel"],
      assigneeId: row.assignee_id ? String(row.assignee_id) : null,
      assigneeName: row.assignee_name ? String(row.assignee_name) : null,
      preview: String(row.last_message_preview ?? ""),
      lastMessageAt: String(row.last_message_at),
      unread: row.unread === true,
    })),
  }
}

export async function getInboxConversationAction(id: string): Promise<{ conversation: InboxConversationDetail | null; error?: string }> {
  const context = await getInboxContext("view")
  if (isErrorContext(context)) return { conversation: null, error: context.error }
  const service = createServiceClient()
  const { data, error } = await service.rpc("get_client_inbox_detail", {
    p_club_id: context.club.clubId,
    p_conversation_id: id,
  })
  if (error || !data) return { conversation: null, error: "Обращение не найдено" }
  const conversation = data as Record<string, unknown>
  const client = conversation.client as Record<string, unknown>
  const messages = (conversation.messages ?? []) as Array<Record<string, unknown>>

  await service.from("client_conversation_reads").upsert({
    conversation_id: String(conversation.id),
    club_id: context.club.clubId,
    staff_id: context.staffId,
    last_read_at: new Date().toISOString(),
  }, { onConflict: "conversation_id,staff_id" })

  return {
    conversation: {
      id: String(conversation.id),
      conversationNo: Number(conversation.conversation_no),
      category: conversation.category as ClientConversationCategory,
      status: conversation.status as ClientConversationStatus,
      priority: conversation.priority as ClientConversationPriority,
      channel: conversation.channel as InboxConversationDetail["channel"],
      assigneeId: conversation.assignee_id ? String(conversation.assignee_id) : null,
      client: {
        id: String(client.id),
        name: String(client.name),
        phone: client.phone ? String(client.phone) : null,
        balance: Number(client.balance ?? 0),
        debt: Number(client.debt ?? 0),
        telegramUsername: client.telegram_username ? String(client.telegram_username) : null,
        membershipName: client.membership_name ? String(client.membership_name) : null,
        membershipExpiresAt: client.membership_expires_at ? String(client.membership_expires_at) : null,
        lastVisitAt: client.last_visit_at ? String(client.last_visit_at) : null,
      },
      messages: messages.map((message) => ({
        id: String(message.id),
        senderType: message.sender_type as InboxMessage["senderType"],
        senderName: message.sender_name ? String(message.sender_name) : null,
        body: String(message.body),
        deliveryStatus: message.delivery_status as InboxMessage["deliveryStatus"],
        deliveryError: message.delivery_error ? String(message.delivery_error) : null,
        createdAt: String(message.created_at),
      })),
    },
  }
}

export async function getInboxStaffAction(): Promise<{ staff: InboxStaff[]; error?: string }> {
  const context = await getInboxContext("view")
  if (isErrorContext(context)) return { staff: [], error: context.error }
  return loadInboxStaff(context)
}

async function loadInboxStaff(context: InboxContext): Promise<{ staff: InboxStaff[]; error?: string }> {
  const service = createServiceClient()
  const { data: rows } = await service.from("staff").select("id, user_id, role")
    .eq("club_id", context.club.clubId).eq("is_active", true).order("created_at")
  const names = await staffNames(context.club.clubId, (rows ?? []).map((row) => row.id))
  return { staff: (rows ?? []).map((row) => ({ id: row.id, name: names.get(row.id) ?? "Сотрудник", role: row.role })) }
}

export async function getReplyTemplatesAction(): Promise<{ templates: InboxReplyTemplate[]; error?: string }> {
  const context = await getInboxContext("view")
  if (isErrorContext(context)) return { templates: [], error: context.error }
  return loadReplyTemplates(context)
}

async function loadReplyTemplates(context: InboxContext): Promise<{ templates: InboxReplyTemplate[]; error?: string }> {
  const { data, error } = await createServiceClient().from("client_reply_templates")
    .select("id, title, body, category, shortcut").eq("club_id", context.club.clubId).eq("is_active", true)
    .order("position").order("title")
  if (error) return { templates: [], error: "Не удалось загрузить шаблоны" }
  return { templates: (data ?? []).map((row) => ({ ...row, category: row.category as ClientConversationCategory })) }
}

export async function getInboxBootstrapAction() {
  const context = await getInboxContext("view")
  if (isErrorContext(context)) {
    return { conversations: [], staff: [], templates: [], currentStaffId: null, error: context.error }
  }
  const [conversations, staff, templates] = await Promise.all([
    loadInboxConversations(context), loadInboxStaff(context), loadReplyTemplates(context),
  ])
  return {
    conversations: conversations.conversations,
    staff: staff.staff,
    templates: templates.templates,
    currentStaffId: context.staffId,
    error: conversations.error ?? staff.error ?? templates.error,
  }
}

export async function sendInboxReplyAction(conversationId: string, body: string): Promise<{ ok: boolean; messageId?: string; deliveryError?: string; error?: string }> {
  const context = await getInboxContext("reply")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  const text = body.trim()
  if (!text) return { ok: false, error: "Введите сообщение" }
  if (text.length > 4000) return { ok: false, error: "Сообщение не должно превышать 4000 символов" }
  const service = createServiceClient()
  const { data: conversation } = await service.from("client_conversations").select("id, status, assignee_id")
    .eq("id", conversationId).eq("club_id", context.club.clubId).maybeSingle()
  if (!conversation) return { ok: false, error: "Обращение не найдено" }
  if (conversation.status === "closed") return { ok: false, error: "Обращение закрыто" }

  if (!conversation.assignee_id) {
    await service.from("client_conversations").update({ assignee_id: context.staffId })
      .eq("id", conversationId).eq("club_id", context.club.clubId).is("assignee_id", null)
  }
  const { data: message, error } = await service.from("client_conversation_messages").insert({
    conversation_id: conversationId,
    club_id: context.club.clubId,
    sender_type: "staff",
    sender_staff_id: context.staffId,
    body: text,
    channel: "telegram",
    delivery_status: "pending",
    next_delivery_at: new Date().toISOString(),
  }).select("id").single()
  if (error || !message) return { ok: false, error: "Не удалось сохранить сообщение" }

  const delivery = await deliverClientConversationMessage(message.id)
  revalidatePath("/inbox")
  return { ok: true, messageId: message.id, deliveryError: delivery.ok ? undefined : delivery.error }
}

export async function updateConversationStatusAction(conversationId: string, status: ClientConversationStatus): Promise<{ ok: boolean; error?: string }> {
  const context = await getInboxContext(status === "closed" ? "assign" : "reply")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  if (!["open", "waiting_client", "resolved", "closed"].includes(status)) return { ok: false, error: "Некорректный статус" }
  const now = new Date().toISOString()
  const { data, error } = await createServiceClient().from("client_conversations").update({
    status,
    resolved_at: status === "resolved" ? now : null,
    closed_at: status === "closed" ? now : null,
    updated_at: now,
  }).eq("id", conversationId).eq("club_id", context.club.clubId).select("id").maybeSingle()
  if (error || !data) return { ok: false, error: "Не удалось изменить статус" }
  revalidatePath("/inbox")
  return { ok: true }
}

export async function assignConversationAction(conversationId: string, staffId: string | null): Promise<{ ok: boolean; error?: string }> {
  const context = await getInboxContext("assign")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  const service = createServiceClient()
  if (staffId) {
    const { data: staff } = await service.from("staff").select("id").eq("id", staffId)
      .eq("club_id", context.club.clubId).eq("is_active", true).maybeSingle()
    if (!staff) return { ok: false, error: "Сотрудник не найден" }
  }
  const { data, error } = await service.from("client_conversations").update({ assignee_id: staffId, updated_at: new Date().toISOString() })
    .eq("id", conversationId).eq("club_id", context.club.clubId).select("id").maybeSingle()
  if (error || !data) return { ok: false, error: "Не удалось назначить сотрудника" }
  revalidatePath("/inbox")
  return { ok: true }
}

export async function retryInboxMessageAction(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const context = await getInboxContext("reply")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  const { data: message } = await createServiceClient().from("client_conversation_messages").select("id")
    .eq("id", messageId).eq("club_id", context.club.clubId).eq("sender_type", "staff").maybeSingle()
  if (!message) return { ok: false, error: "Сообщение не найдено" }
  return deliverClientConversationMessage(message.id)
}

export async function saveReplyTemplateAction(input: {
  id?: string
  title: string
  body: string
  category: ClientConversationCategory
  shortcut?: string
}): Promise<{ ok: boolean; error?: string }> {
  const context = await getInboxContext("manage_templates")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  const title = input.title.trim()
  const body = input.body.trim()
  const shortcut = input.shortcut?.trim().replace(/^\//, "").toLowerCase() || null
  if (!title || !body) return { ok: false, error: "Заполните название и текст" }
  if (!CLIENT_INBOX_CATEGORIES.some((category) => category.key === input.category)) return { ok: false, error: "Некорректная категория" }
  const service = createServiceClient()
  const payload = { title, body, category: input.category, shortcut, updated_at: new Date().toISOString() }
  const result = input.id
    ? await service.from("client_reply_templates").update(payload).eq("id", input.id).eq("club_id", context.club.clubId)
    : await service.from("client_reply_templates").insert({ ...payload, club_id: context.club.clubId, created_by: context.staffId })
  if (result.error) return { ok: false, error: result.error.code === "23505" ? "Такое сокращение уже используется" : "Не удалось сохранить шаблон" }
  revalidatePath("/inbox")
  return { ok: true }
}

export async function deleteReplyTemplateAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const context = await getInboxContext("manage_templates")
  if (isErrorContext(context)) return { ok: false, error: context.error }
  const { error } = await createServiceClient().from("client_reply_templates").delete()
    .eq("id", id).eq("club_id", context.club.clubId)
  if (error) return { ok: false, error: "Не удалось удалить шаблон" }
  revalidatePath("/inbox")
  return { ok: true }
}
