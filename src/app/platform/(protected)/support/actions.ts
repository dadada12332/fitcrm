"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { getPlatformAuth, logPlatformAction } from "@/lib/platform"
import { revalidatePath } from "next/cache"

export type PfStatus = "new" | "in_progress" | "needs_info" | "resolved" | "closed"

export type PfTicketRow = {
  id: string
  ticketNo: number
  subject: string
  category: string
  status: PfStatus
  clubName: string
  createdAt: string
  lastMessageAt: string
  agentUnread: boolean
  preview: string
}

export type PfMessage = {
  id: string
  authorType: "user" | "agent" | "ai" | "system"
  body: string
  createdAt: string
  visibility: "public" | "internal"
  attachments: { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null; url: string }[]
}

export type PfTicketDetail = {
  id: string
  ticketNo: number
  subject: string
  category: string
  status: PfStatus
  priority: string
  clubId: string | null
  clubName: string
  createdAt: string
  csatRating: number | null
  csatComment: string | null
  clientMeta: Record<string, unknown>
  messages: PfMessage[]
}

// ── Список всех обращений на платформе ─────────────────────────────────────
export async function pfListTicketsAction(filter?: { status?: string; q?: string }): Promise<{ rows: PfTicketRow[]; counts: Record<string, number> }> {
  const auth = await getPlatformAuth()
  if (!auth) return { rows: [], counts: {} }
  const db = createServiceClient()

  let q = db
    .from("support_tickets")
    .select("id, ticket_no, subject, category, status, created_at, last_message_at, agent_last_read_at, club_id, clubs(name)")
    .order("last_message_at", { ascending: false })
    .limit(300)
  if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status)

  const { data } = await q
  let rows = data ?? []

  if (filter?.q?.trim()) {
    const s = filter.q.toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = rows.filter((t: any) => t.subject?.toLowerCase().includes(s) || (t.clubs?.name ?? "").toLowerCase().includes(s) || String(t.ticket_no).includes(s))
  }

  const ids = rows.map((t) => t.id)
  const previews: Record<string, string> = {}
  if (ids.length) {
    const { data: msgs } = await db
      .from("support_messages")
      .select("ticket_id, body, author_type, created_at")
      .in("ticket_id", ids)
      .neq("author_type", "system")
      .order("created_at", { ascending: false })
    for (const m of msgs ?? []) {
      if (!previews[m.ticket_id]) previews[m.ticket_id] = (m.author_type === "user" ? "Клуб: " : "Мы: ") + (m.body || "")
    }
  }

  // счётчики по статусам (для табов)
  const { data: allStatuses } = await db.from("support_tickets").select("status")
  const counts: Record<string, number> = { all: allStatuses?.length ?? 0 }
  for (const r of allStatuses ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: rows.map((t: any) => ({
      id: t.id,
      ticketNo: t.ticket_no,
      subject: t.subject,
      category: t.category,
      status: t.status,
      clubName: t.clubs?.name ?? "—",
      createdAt: t.created_at,
      lastMessageAt: t.last_message_at,
      agentUnread: !t.agent_last_read_at || new Date(t.last_message_at) > new Date(t.agent_last_read_at),
      preview: previews[t.id] ?? "",
    })),
    counts,
  }
}

// ── Один тикет для оператора (с диагностикой и внутренними заметками) ───────
export async function pfGetTicketAction(id: string): Promise<{ ticket: PfTicketDetail | null }> {
  const auth = await getPlatformAuth()
  if (!auth) return { ticket: null }
  const db = createServiceClient()

  const { data: t } = await db
    .from("support_tickets")
    .select("id, ticket_no, subject, category, status, priority, club_id, created_at, csat_rating, csat_comment, client_meta, clubs(name)")
    .eq("id", id)
    .maybeSingle()
  if (!t) return { ticket: null }

  const { data: msgs } = await db
    .from("support_messages")
    .select("id, author_type, body, created_at, visibility")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true })

  const msgIds = (msgs ?? []).map((m) => m.id)
  const attByMsg: Record<string, PfMessage["attachments"]> = {}
  if (msgIds.length) {
    const { data: atts } = await db
      .from("support_attachments")
      .select("id, message_id, storage_path, file_name, mime_type, size_bytes")
      .in("message_id", msgIds)
    for (const a of atts ?? []) {
      const { data: signed } = await db.storage.from("support").createSignedUrl(a.storage_path, 3600)
      ;(attByMsg[a.message_id] ??= []).push({ id: a.id, fileName: a.file_name, mimeType: a.mime_type, sizeBytes: a.size_bytes, url: signed?.signedUrl ?? "" })
    }
  }

  // оператор увидел → отметить прочитанным для агента
  await db.from("support_tickets").update({ agent_last_read_at: new Date().toISOString() }).eq("id", id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tt = t as any
  return {
    ticket: {
      id: tt.id, ticketNo: tt.ticket_no, subject: tt.subject, category: tt.category, status: tt.status, priority: tt.priority,
      clubId: tt.club_id, clubName: tt.clubs?.name ?? "—", createdAt: tt.created_at,
      csatRating: tt.csat_rating, csatComment: tt.csat_comment,
      clientMeta: (tt.client_meta ?? {}) as Record<string, unknown>,
      messages: (msgs ?? []).map((m) => ({
        id: m.id, authorType: m.author_type, body: m.body, createdAt: m.created_at, visibility: m.visibility,
        attachments: attByMsg[m.id] ?? [],
      })),
    },
  }
}

// ── Ответ оператора ────────────────────────────────────────────────────────
export async function pfReplyAction(ticketId: string, body: string, visibility: "public" | "internal" = "public"): Promise<{ ok: boolean; error?: string }> {
  const auth = await getPlatformAuth()
  if (!auth) return { ok: false, error: "Нет доступа" }
  const text = body.trim()
  if (!text) return { ok: false, error: "Пустое сообщение" }
  const db = createServiceClient()
  const { data: ticket, error: ticketError } = await db
    .from("support_tickets")
    .select("status, club_id")
    .eq("id", ticketId)
    .maybeSingle()
  if (ticketError || !ticket) return { ok: false, error: "Обращение не найдено" }

  const { error: messageError } = await db.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "agent",
    author_id: auth.userId,
    body: text,
    visibility,
  })
  if (messageError) return { ok: false, error: "Не удалось отправить сообщение" }
  // публичный ответ переводит новое обращение «в работу»
  if (visibility === "public") {
    if (ticket.status === "new") {
      const { error: updateError } = await db.from("support_tickets").update({ status: "in_progress" }).eq("id", ticketId)
      if (updateError) return { ok: false, error: "Ответ отправлен, но статус не обновился" }
    }
    await logPlatformAction({ action: "support_reply", clubId: ticket.club_id, meta: { ticketId, visibility } })
  } else {
    await logPlatformAction({ action: "support_internal_note", clubId: ticket.club_id, meta: { ticketId } })
  }
  revalidatePath("/platform/support")
  return { ok: true }
}

// ── Смена статуса ──────────────────────────────────────────────────────────
const STATUS_LABEL: Record<PfStatus, string> = {
  new: "Новый", in_progress: "В работе", needs_info: "Требуются данные", resolved: "Решено", closed: "Закрыт",
}

export async function pfSetStatusAction(ticketId: string, status: PfStatus): Promise<{ ok: boolean; error?: string }> {
  const auth = await getPlatformAuth()
  if (!auth) return { ok: false }
  const db = createServiceClient()

  const { data: ticket, error: ticketError } = await db.from("support_tickets").select("club_id").eq("id", ticketId).maybeSingle()
  if (ticketError || !ticket) return { ok: false, error: "Обращение не найдено" }

  const patch: Record<string, unknown> = { status, agent_last_read_at: new Date().toISOString() }
  if (status === "resolved") patch.resolved_at = new Date().toISOString()
  if (status === "closed") patch.closed_at = new Date().toISOString()
  const { data: updated, error } = await db.from("support_tickets").update(patch).eq("id", ticketId).select("id").maybeSingle()
  if (error || !updated) return { ok: false, error: "Не удалось изменить статус" }
  const { error: messageError } = await db.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "system",
    body: `Статус изменён: ${STATUS_LABEL[status]}`,
  })
  if (messageError) return { ok: false, error: "Статус изменён, но событие не записалось в историю" }
  await logPlatformAction({ action: "support_status_change", clubId: ticket.club_id, meta: { ticketId, status } })
  revalidatePath("/platform/support")
  return { ok: true }
}
