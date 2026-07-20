"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { getAuthUser } from "@/lib/auth"
import { retrieveKnowledge } from "@/lib/knowledge"
import { revalidatePath } from "next/cache"

// ── Типы ──────────────────────────────────────────────────────────────────
export type TicketStatus = "new" | "in_progress" | "needs_info" | "resolved" | "closed"
export type TicketCategory = "import" | "payments" | "integrations" | "subscription" | "error" | "feature" | "other"

export type TicketListItem = {
  id: string
  ticketNo: number
  subject: string
  category: TicketCategory
  status: TicketStatus
  lastMessageAt: string
  unread: boolean          // есть ответ поддержки, который юзер ещё не открыл
  preview: string
}

export type TicketAttachment = {
  id: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  url: string           // подписанный URL (приватный бакет)
}

export type TicketMessage = {
  id: string
  authorType: "user" | "agent" | "ai" | "system"
  body: string
  createdAt: string
  meta: Record<string, unknown>
  attachments: TicketAttachment[]
}

// Загруженный файл, готовый к привязке к сообщению.
export type AttachmentInput = { path: string; fileName: string; mimeType: string | null; sizeBytes: number | null }

export type TicketDetail = {
  id: string
  ticketNo: number
  subject: string
  category: TicketCategory
  status: TicketStatus
  createdAt: string
  csatRating: number | null
  messages: TicketMessage[]
}

// ── Список обращений ───────────────────────────────────────────────────────
export async function listTicketsAction(): Promise<{ tickets: TicketListItem[]; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { tickets: [], error: "Клуб не найден" }
  const db = createServiceClient()

  const { data, error } = await db
    .from("support_tickets")
    .select("id, ticket_no, subject, category, status, last_message_at, agent_last_read_at, user_last_read_at")
    .eq("club_id", club.clubId)
    .order("last_message_at", { ascending: false })
    .limit(200)

  if (error) return { tickets: [], error: error.message }

  // превью = последнее публичное сообщение по каждому тикету
  const ids = (data ?? []).map((t) => t.id)
  const previews: Record<string, string> = {}
  if (ids.length) {
    const { data: msgs } = await db
      .from("support_messages")
      .select("ticket_id, body, created_at, author_type")
      .in("ticket_id", ids)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
    for (const m of msgs ?? []) {
      if (!previews[m.ticket_id] && m.author_type !== "system") {
        previews[m.ticket_id] = (m.author_type === "user" ? "Вы: " : "Поддержка: ") + (m.body || "")
      }
    }
  }

  const tickets: TicketListItem[] = (data ?? []).map((t) => ({
    id: t.id,
    ticketNo: t.ticket_no,
    subject: t.subject,
    category: t.category,
    status: t.status,
    lastMessageAt: t.last_message_at,
    preview: previews[t.id] ?? "",
    unread: !!t.agent_last_read_at && new Date(t.agent_last_read_at) > new Date(t.user_last_read_at),
  }))

  return { tickets }
}

// ── Один тикет с перепиской ────────────────────────────────────────────────
export async function getTicketAction(id: string): Promise<{ ticket: TicketDetail | null; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { ticket: null, error: "Клуб не найден" }
  const db = createServiceClient()

  const { data: t, error } = await db
    .from("support_tickets")
    .select("id, ticket_no, subject, category, status, created_at, csat_rating, club_id")
    .eq("id", id)
    .eq("club_id", club.clubId)
    .maybeSingle()
  if (error) return { ticket: null, error: error.message }
  if (!t) return { ticket: null, error: "Обращение не найдено" }

  const { data: msgs } = await db
    .from("support_messages")
    .select("id, author_type, body, created_at, meta")
    .eq("ticket_id", id)
    .eq("visibility", "public")           // внутренние заметки операторов клубу не отдаём
    .order("created_at", { ascending: true })

  // вложения всех сообщений тикета + подписанные URL (приватный бакет)
  const msgIds = (msgs ?? []).map((m) => m.id)
  const attByMsg: Record<string, TicketAttachment[]> = {}
  if (msgIds.length) {
    const { data: atts } = await db
      .from("support_attachments")
      .select("id, message_id, storage_path, file_name, mime_type, size_bytes")
      .in("message_id", msgIds)
    for (const a of atts ?? []) {
      const { data: signed } = await db.storage.from("support").createSignedUrl(a.storage_path, 3600)
      ;(attByMsg[a.message_id] ??= []).push({
        id: a.id, fileName: a.file_name, mimeType: a.mime_type, sizeBytes: a.size_bytes, url: signed?.signedUrl ?? "",
      })
    }
  }

  // отметить прочитанным
  await db.from("support_tickets").update({ user_last_read_at: new Date().toISOString() }).eq("id", id)

  return {
    ticket: {
      id: t.id,
      ticketNo: t.ticket_no,
      subject: t.subject,
      category: t.category,
      status: t.status,
      createdAt: t.created_at,
      csatRating: t.csat_rating,
      messages: (msgs ?? []).map((m) => ({
        id: m.id,
        authorType: m.author_type,
        body: m.body,
        createdAt: m.created_at,
        meta: (m.meta ?? {}) as Record<string, unknown>,
        attachments: attByMsg[m.id] ?? [],
      })),
    },
  }
}

// ── Создать обращение ──────────────────────────────────────────────────────
export async function createTicketAction(input: {
  category: TicketCategory
  subject: string
  body: string
  clientMeta?: Record<string, unknown>
  source?: "user" | "ai_escalation"
  attachments?: AttachmentInput[]
}): Promise<{ id: string | null; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { id: null, error: "Клуб не найден" }
  const user = await getAuthUser()
  const db = createServiceClient()

  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject) return { id: null, error: "Укажите тему обращения" }

  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({
      club_id: club.clubId,
      created_by: user?.id ?? null,
      category: input.category,
      subject,
      source: input.source ?? "user",
      client_meta: input.clientMeta ?? {},
    })
    .select("id")
    .single()
  if (error || !ticket) return { id: null, error: error?.message ?? "Не удалось создать обращение" }

  const atts = (input.attachments ?? []).filter((a) => a.path.startsWith(`${club.clubId}/`))
  if (body || atts.length) {
    const { data: msg } = await db.from("support_messages").insert({
      ticket_id: ticket.id,
      author_type: "user",
      author_id: user?.id ?? null,
      body,
    }).select("id").single()
    if (msg && atts.length) await insertAttachments(db, msg.id, atts)
  }

  revalidatePath("/support")
  return { id: ticket.id }
}

// ── Загрузка файла в приватный бакет support ────────────────────────────────
const ALLOWED_MIME = /^(image\/|video\/|application\/pdf|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/)/
const MAX_FILE = 20 * 1024 * 1024

export async function uploadSupportFileAction(formData: FormData): Promise<{ file: AttachmentInput | null; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { file: null, error: "Клуб не найден" }
  const file = formData.get("file") as File | null
  if (!file) return { file: null, error: "Файл не выбран" }
  if (file.size > MAX_FILE) return { file: null, error: "Файл больше 20 МБ" }
  if (file.type && !ALLOWED_MIME.test(file.type)) return { file: null, error: "Недопустимый тип файла" }

  const db = createServiceClient()
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80)
  const path = `${club.clubId}/${crypto.randomUUID()}-${safe}`
  const { error } = await db.storage.from("support").upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) return { file: null, error: error.message }

  return { file: { path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.size } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertAttachments(db: any, messageId: string, atts: AttachmentInput[]) {
  await db.from("support_attachments").insert(
    atts.map((a) => ({ message_id: messageId, storage_path: a.path, file_name: a.fileName, mime_type: a.mimeType, size_bytes: a.sizeBytes }))
  )
}

// ── Отправить сообщение в тикет ────────────────────────────────────────────
export async function sendTicketMessageAction(ticketId: string, body: string, attachments?: AttachmentInput[]): Promise<{ ok: boolean; error?: string }> {
  const club = await getCurrentClub()
  if (!club) return { ok: false, error: "Клуб не найден" }
  const user = await getAuthUser()
  const db = createServiceClient()

  const text = body.trim()
  const atts = (attachments ?? []).filter((a) => a.path.startsWith(`${club.clubId}/`))
  if (!text && !atts.length) return { ok: false, error: "Пустое сообщение" }

  // проверяем принадлежность тикета клубу
  const { data: t } = await db
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("club_id", club.clubId)
    .maybeSingle()
  if (!t) return { ok: false, error: "Обращение не найдено" }

  // завершённое обращение (решено/закрыто) больше не принимает сообщений — нужно создать новое
  if (t.status === "resolved" || t.status === "closed") {
    return { ok: false, error: "Обращение завершено. Создайте новое обращение." }
  }

  const { data: msg } = await db.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "user",
    author_id: user?.id ?? null,
    body: text,
  }).select("id").single()
  if (msg && atts.length) await insertAttachments(db, msg.id, atts)

  revalidatePath("/support")
  return { ok: true }
}

// ── Оценка после закрытия ──────────────────────────────────────────────────
export async function rateTicketAction(ticketId: string, rating: number, comment?: string): Promise<{ ok: boolean }> {
  const club = await getCurrentClub()
  if (!club) return { ok: false }
  const db = createServiceClient()
  await db
    .from("support_tickets")
    .update({ csat_rating: Math.max(1, Math.min(5, rating)), csat_comment: comment ?? null })
    .eq("id", ticketId)
    .eq("club_id", club.clubId)
  revalidatePath("/support")
  return { ok: true }
}

// ── Support-AI: Gemini + RAG по Базе знаний ────────────────────────────────
const SUPPORT_MODEL = "gemini-2.5-flash"

export type SupportChatTurn = { role: "user" | "ai"; text: string }

export async function askSupportAction(history: SupportChatTurn[]): Promise<{
  reply: string
  links: { id: string; title: string }[]
  error?: string
}> {
  const club = await getCurrentClub()
  if (!club) return { reply: "", links: [], error: "Не авторизован" }
  const key = process.env.GEMINI_API_KEY
  if (!key) return { reply: "", links: [], error: "no_key" }   // UI откатится на локальный ответчик

  const lastUser = [...history].reverse().find((t) => t.role === "user")?.text ?? ""
  const articles = retrieveKnowledge(lastUser, 4)

  const kbContext = articles.length
    ? articles.map((a, i) => `[${i + 1}] Статья «${a.title}» (раздел «${a.categoryTitle}»):\n${a.text}`).join("\n\n")
    : "(по этому вопросу подходящих статей не найдено)"

  const systemInstruction = {
    parts: [{
      text:
        `Ты — ассистент поддержки FitCRM (CRM для фитнес-клубов), помогаешь сотруднику клуба «${club.clubName}». ` +
        `Твоя задача — решить проблему пользователя, опираясь ТОЛЬКО на приведённую базу знаний и общие принципы работы CRM. ` +
        `Отвечай кратко и по делу на русском, при необходимости — пошагово (нумерованный список). ` +
        `Если в базе знаний нет ответа — честно скажи, что не уверен, и предложи создать обращение в поддержку. ` +
        `Не выдумывай функции, которых нет. Валюта — сум.\n\n` +
        `БАЗА ЗНАНИЙ:\n${kbContext}`,
    }],
  }

  const contents = history.map((t) => ({
    role: t.role === "user" ? "user" : "model",
    parts: [{ text: t.text }],
  }))

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${SUPPORT_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction, contents, generationConfig: { temperature: 0.3 } }),
    })
    const data = await res.json()
    if (data.error) {
      if (data.error.code === 429) return { reply: "", links: [], error: "Слишком много запросов — подождите минуту." }
      return { reply: "", links: [], error: "no_key" } // мягкий откат на локальный ответчик
    }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reply = parts.map((p: any) => p.text).filter(Boolean).join("").trim()
    if (!reply) return { reply: "", links: [], error: "no_key" }
    return { reply, links: articles.map((a) => ({ id: a.id, title: a.title })) }
  } catch {
    return { reply: "", links: [], error: "no_key" }
  }
}
