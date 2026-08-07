"use server"

import { revalidatePath } from "next/cache"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { can, type RolePermissions } from "@/lib/permissions"
import { normalizeLeadPhone, type LeadPriority, type LeadTaskType, type LeadTrialStatus } from "@/lib/leads"
import { createServiceClient } from "@/lib/supabase/service"

type ActionResult<T extends Record<string, unknown> = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; duplicates?: LeadDuplicate[] }

export type LeadDuplicate = {
  type: "lead" | "client"
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

type LeadActionContext = {
  clubId: string
  permissions: RolePermissions
  staffId: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TASK_TYPES = new Set<LeadTaskType>(["call", "message", "trial", "follow_up", "proposal", "other"])
const PRIORITIES = new Set<LeadPriority>(["low", "normal", "high", "urgent"])
const TRIAL_OUTCOMES = new Set<LeadTrialStatus>(["attended", "no_show", "cancelled"])
const ACTIVITY_KINDS = new Set(["call", "message", "note", "meeting", "outcome", "system"])
const CHANNELS = new Set(["phone", "telegram", "instagram", "whatsapp", "email", "web", "in_person", "internal"])
const PREFERRED_CHANNELS = new Set(["phone", "telegram", "instagram", "whatsapp", "email", "other"])
const DIRECTIONS = new Set(["inbound", "outbound", "internal"])
const OUTCOMES = new Set(["connected", "no_answer", "interested", "not_interested", "scheduled", "completed", "no_show", "sent", "failed", "other"])

function cleanText(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? "" : null
  const cleaned = value.trim().replace(/\s+/g, " ")
  if (!cleaned) return required ? "" : null
  return cleaned.slice(0, max)
}

function cleanMultiline(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function optionalUuid(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  return UUID_RE.test(value) ? value : null
}

function requiredUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null
}

function finiteMoney(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(number) ? Math.min(999_999_999_999, Math.max(0, Math.round(number * 100) / 100)) : 0
}

function positiveVersion(value: unknown): number | null {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function futureDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  if (date.getTime() <= Date.now()) return null
  return date.toISOString()
}

function mapRpcError(message: string): string {
  if (message.includes("lead_version_conflict")) return "Лид уже изменился. Обновите данные и повторите действие."
  if (message.includes("lead_not_found")) return "Лид не найден или уже недоступен."
  if (message.includes("lead_archived")) return "Лид находится в архиве."
  if (message.includes("lead_won_immutable")) return "Конвертированного лида нельзя вернуть на другой этап."
  if (message.includes("converted_lead_cannot_be_reopened")) return "Конвертированного лида нельзя вернуть на другой этап."
  if (message.includes("lead_won_requires_conversion")) return "Этап «Конвертирован» ставится только через создание клиента."
  if (message.includes("lead_loss_reason_required")) return "Выберите причину потери лида."
  if (message.includes("lead_interest_required")) return "Перед квалификацией укажите интерес клиента."
  if (message.includes("lead_trial_required")) return "Сначала назначьте пробное занятие."
  if (message.includes("lead_trial_attendance_required")) return "Сначала подтвердите посещение пробного занятия."
  if (message.includes("lead_client_identity_mismatch")) return "Выбранный клиент не совпадает с телефоном или email лида."
  if (message.includes("plan_limit_exceeded:clients")) return "Достигнут лимит клиентов текущего тарифа."
  if (message.includes("platform_subscription_locked")) return "Продлите подписку Zalkins, чтобы продолжить работу."
  if (message.includes("lead_duplicate_external_ref")) return "Эта заявка уже была импортирована."
  return "Не удалось сохранить изменения. Попробуйте ещё раз."
}

async function getLeadActionContext(
  action: keyof RolePermissions["leads"],
): Promise<LeadActionContext | { error: string }> {
  const [club, user] = await Promise.all([getCurrentClub(), getAuthUser()])
  if (!club || !user) return { error: "Сессия истекла. Войдите снова." }
  if (club.impersonating) return { error: "В режиме просмотра изменения недоступны." }
  if (!can(club.permissions, "leads", action)) return { error: "Недостаточно прав для этого действия." }

  const service = createServiceClient()
  const { data: staff } = await service
    .from("staff")
    .select("id")
    .eq("club_id", club.clubId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()
  if (!staff) return { error: "Активный профиль сотрудника не найден." }
  return { clubId: club.clubId, permissions: club.permissions, staffId: staff.id }
}

function rpcPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {}
  return data as Record<string, unknown>
}

function rpcDuplicates(data: Record<string, unknown>): LeadDuplicate[] {
  const value = data.duplicates
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if ((row.type !== "lead" && row.type !== "client") || typeof row.id !== "string" || typeof row.name !== "string") return []
    return [{
      type: row.type,
      id: row.id,
      name: row.name,
      phone: typeof row.phone === "string" ? row.phone : null,
      email: typeof row.email === "string" ? row.email : null,
    }]
  })
}

function visibleDuplicates(data: Record<string, unknown>, permissions: RolePermissions): LeadDuplicate[] {
  return rpcDuplicates(data).filter((duplicate) => (
    duplicate.type === "lead"
      ? can(permissions, "leads", "view")
      : can(permissions, "clients", "view")
  ))
}

function refreshLeads() {
  revalidatePath("/leads")
  revalidatePath("/dashboard")
}

export type CreateLeadInput = {
  fullName: string
  phone?: string | null
  email?: string | null
  sourceKey?: string
  assigneeStaffId?: string | null
  interest?: string | null
  estimatedValue?: number
  notes?: string | null
  allowDuplicate?: boolean
  externalRef?: string | null
}

export async function createLeadAction(input: CreateLeadInput): Promise<ActionResult<{ leadId: string; version: number }>> {
  const context = await getLeadActionContext("create")
  if ("error" in context) return { ok: false, error: context.error }
  const fullName = cleanText(input.fullName, 160, true)
  const phone = cleanText(input.phone, 40)
  const email = cleanText(input.email, 254)?.toLowerCase() ?? null
  if (!fullName) return { ok: false, error: "Укажите имя лида." }
  if (!phone && !email) return { ok: false, error: "Укажите телефон или email." }
  if (phone && normalizeLeadPhone(phone).length < 7) return { ok: false, error: "Проверьте номер телефона." }
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Проверьте email." }
  if (input.assigneeStaffId && !requiredUuid(input.assigneeStaffId)) return { ok: false, error: "Некорректный сотрудник." }
  let assigneeStaffId = optionalUuid(input.assigneeStaffId)
  if (!can(context.permissions, "leads", "assign")) {
    if (assigneeStaffId && assigneeStaffId !== context.staffId) {
      return { ok: false, error: "Недостаточно прав для назначения другого сотрудника." }
    }
    assigneeStaffId = context.staffId
  }

  const service = createServiceClient()
  const { data, error } = await service.rpc("create_lead", {
    p_club_id: context.clubId,
    p_actor_staff_id: context.staffId,
    p_full_name: fullName,
    p_phone: phone,
    p_email: email,
    p_source_key: cleanText(input.sourceKey, 40) ?? "manual",
    p_assigned_staff_id: assigneeStaffId,
    p_interest: cleanText(input.interest, 300),
    p_estimated_value: finiteMoney(input.estimatedValue),
    p_notes: cleanMultiline(input.notes, 5_000),
    p_allow_duplicate: input.allowDuplicate === true,
    p_external_ref: cleanText(input.externalRef, 200),
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  const payload = rpcPayload(data)
  const duplicates = visibleDuplicates(payload, context.permissions)
  if (payload.status === "duplicate") {
    return {
      ok: false,
      error: duplicates.length > 0
        ? "Найдены совпадения. Проверьте карточки перед созданием дубля."
        : "Контакт уже есть в CRM, но у вас нет прав на просмотр совпадения.",
      code: "duplicate",
      duplicates,
    }
  }
  if (typeof payload.lead_id !== "string") return { ok: false, error: "Сервер не вернул созданного лида." }
  refreshLeads()
  return { ok: true, leadId: payload.lead_id, version: Number(payload.version ?? 1) }
}

export type UpdateLeadInput = {
  leadId: string
  expectedVersion: number
  fullName: string
  phone?: string | null
  email?: string | null
  sourceKey: string
  interest?: string | null
  estimatedValue?: number
  notes?: string | null
  tags?: string[]
  priority?: LeadPriority
  preferredChannel?: string | null
}

export async function updateLeadAction(input: UpdateLeadInput): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const expectedVersion = positiveVersion(input.expectedVersion)
  const fullName = cleanText(input.fullName, 160, true)
  const phone = cleanText(input.phone, 40)
  const email = cleanText(input.email, 254)?.toLowerCase() ?? null
  if (!leadId || !expectedVersion) return { ok: false, error: "Некорректная версия лида." }
  if (!fullName) return { ok: false, error: "Укажите имя лида." }
  if (!phone && !email) return { ok: false, error: "Укажите телефон или email." }
  if (phone && normalizeLeadPhone(phone).length < 7) return { ok: false, error: "Проверьте номер телефона." }
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Проверьте email." }
  const tags = [...new Set((input.tags ?? []).map((tag) => cleanText(tag, 40)).filter((tag): tag is string => !!tag))].slice(0, 20)
  const priority = PRIORITIES.has(input.priority as LeadPriority) ? input.priority! : "normal"

  const { data, error } = await createServiceClient().rpc("update_lead_details", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_expected_version: expectedVersion,
    p_full_name: fullName,
    p_phone: phone,
    p_email: email,
    p_source_key: cleanText(input.sourceKey, 40) ?? "other",
    p_interest: cleanText(input.interest, 300),
    p_estimated_value: finiteMoney(input.estimatedValue),
    p_notes: cleanMultiline(input.notes, 5_000),
    p_tags: tags,
    p_priority: priority,
    p_preferred_channel: PREFERRED_CHANNELS.has(input.preferredChannel ?? "") ? input.preferredChannel : null,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? expectedVersion + 1) }
}

export async function assignLeadAction(input: {
  leadId: string
  assigneeStaffId: string | null
  expectedVersion: number
}): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("assign")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const expectedVersion = positiveVersion(input.expectedVersion)
  if (!leadId || !expectedVersion) return { ok: false, error: "Некорректный лид." }
  if (input.assigneeStaffId && !requiredUuid(input.assigneeStaffId)) return { ok: false, error: "Некорректный сотрудник." }
  const { data, error } = await createServiceClient().rpc("assign_lead", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_assignee_staff_id: input.assigneeStaffId,
    p_expected_version: expectedVersion,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? expectedVersion + 1) }
}

export async function moveLeadStageAction(input: {
  leadId: string
  stageKey: string
  expectedVersion: number
  lossReasonKey?: string | null
  lossNote?: string | null
}): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const expectedVersion = positiveVersion(input.expectedVersion)
  const stageKey = cleanText(input.stageKey, 40, true)
  if (!leadId || !expectedVersion || !stageKey) return { ok: false, error: "Некорректный переход этапа." }
  const { data, error } = await createServiceClient().rpc("move_lead_stage", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_stage_key: stageKey,
    p_loss_reason_key: cleanText(input.lossReasonKey, 40),
    p_loss_note: cleanMultiline(input.lossNote, 1_000),
    p_expected_version: expectedVersion,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? expectedVersion + 1) }
}

export async function createLeadTaskAction(input: {
  leadId: string
  type: LeadTaskType
  title: string
  note?: string | null
  dueAt: string
  assignedStaffId?: string | null
  priority?: LeadPriority
}): Promise<ActionResult<{ taskId: string; version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const dueAt = futureDate(input.dueAt)
  const title = cleanText(input.title, 200, true)
  if (!leadId || !TASK_TYPES.has(input.type) || !dueAt || !title) return { ok: false, error: "Заполните действие и будущий срок." }
  if (input.assignedStaffId && !requiredUuid(input.assignedStaffId)) return { ok: false, error: "Некорректный сотрудник." }
  const assignedStaffId = optionalUuid(input.assignedStaffId) ?? context.staffId
  if (assignedStaffId !== context.staffId && !can(context.permissions, "leads", "assign")) {
    return { ok: false, error: "Недостаточно прав для назначения задачи другому сотруднику." }
  }
  const { data, error } = await createServiceClient().rpc("create_lead_task", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_type: input.type,
    p_title: title,
    p_note: cleanMultiline(input.note, 1_000),
    p_due_at: dueAt,
    p_assigned_staff_id: assignedStaffId,
    p_priority: PRIORITIES.has(input.priority as LeadPriority) ? input.priority : "normal",
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  const payload = rpcPayload(data)
  return { ok: true, taskId: String(payload.task_id ?? ""), version: Number(payload.version ?? 1) }
}

export async function completeLeadTaskAction(input: {
  leadId: string
  taskId: string
  outcome?: string | null
  note?: string | null
}): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const taskId = requiredUuid(input.taskId)
  if (!leadId || !taskId) return { ok: false, error: "Некорректная задача." }
  const { data, error } = await createServiceClient().rpc("complete_lead_task", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_task_id: taskId,
    p_actor_staff_id: context.staffId,
    p_outcome: OUTCOMES.has(input.outcome ?? "") ? input.outcome : "completed",
    p_note: cleanMultiline(input.note, 1_000),
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? 1) }
}

export async function recordLeadActivityAction(input: {
  leadId: string
  kind: string
  channel?: string | null
  direction?: string | null
  outcome?: string | null
  body?: string | null
}): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  if (!leadId || !ACTIVITY_KINDS.has(input.kind)) return { ok: false, error: "Некорректный тип активности." }
  const body = cleanMultiline(input.body, 5_000)
  if (input.kind === "note" && !body) return { ok: false, error: "Введите текст заметки." }
  const { data, error } = await createServiceClient().rpc("record_lead_activity", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_kind: input.kind,
    p_channel: CHANNELS.has(input.channel ?? "") ? input.channel : null,
    p_direction: DIRECTIONS.has(input.direction ?? "") ? input.direction : null,
    p_outcome: OUTCOMES.has(input.outcome ?? "") ? input.outcome : null,
    p_body: body,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? 1) }
}

export async function scheduleLeadTrialAction(input: {
  leadId: string
  title: string
  scheduledAt: string
  durationMinutes?: number
  trainerStaffId?: string | null
  notes?: string | null
}): Promise<ActionResult<{ trialId: string; version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const scheduledAt = futureDate(input.scheduledAt)
  const title = cleanText(input.title, 200, true)
  const durationMinutes = Number(input.durationMinutes ?? 60)
  if (!leadId || !scheduledAt || !title || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    return { ok: false, error: "Проверьте дату и длительность пробного занятия." }
  }
  const trainerStaffId = input.trainerStaffId ? requiredUuid(input.trainerStaffId) : null
  if (input.trainerStaffId && !trainerStaffId) return { ok: false, error: "Некорректный тренер." }
  if (trainerStaffId && trainerStaffId !== context.staffId && !can(context.permissions, "leads", "assign")) {
    return { ok: false, error: "Недостаточно прав, чтобы назначить другого тренера." }
  }
  const { data, error } = await createServiceClient().rpc("schedule_lead_trial", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_title: title,
    p_scheduled_at: scheduledAt,
    p_duration_minutes: durationMinutes,
    p_trainer_staff_id: trainerStaffId,
    p_notes: cleanMultiline(input.notes, 1_000),
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  const payload = rpcPayload(data)
  return { ok: true, trialId: String(payload.trial_id ?? ""), version: Number(payload.version ?? 1) }
}

export async function markLeadTrialOutcomeAction(input: {
  leadId: string
  trialId: string
  status: LeadTrialStatus
  notes?: string | null
}): Promise<ActionResult<{ version: number }>> {
  const context = await getLeadActionContext("edit")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const trialId = requiredUuid(input.trialId)
  if (!leadId || !trialId || !TRIAL_OUTCOMES.has(input.status)) return { ok: false, error: "Некорректный результат пробного занятия." }
  const { data, error } = await createServiceClient().rpc("mark_lead_trial_outcome", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_trial_id: trialId,
    p_actor_staff_id: context.staffId,
    p_status: input.status,
    p_notes: cleanMultiline(input.notes, 1_000),
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true, version: Number(rpcPayload(data).version ?? 1) }
}

export async function convertLeadAction(input: {
  leadId: string
  existingClientId?: string | null
}): Promise<ActionResult<{ clientId: string; mode: "new_client" | "existing_client" }>> {
  const context = await getLeadActionContext("convert")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const existingClientId = optionalUuid(input.existingClientId)
  if (!leadId) return { ok: false, error: "Некорректный лид." }
  if (input.existingClientId && !existingClientId) return { ok: false, error: "Некорректный клиент." }
  if (!can(context.permissions, "clients", "create")) {
    return { ok: false, error: "Для конвертации нужно право «Клиенты → Создание»." }
  }
  if (existingClientId && !can(context.permissions, "clients", "view")) {
    return { ok: false, error: "Недостаточно прав для связывания с клиентом." }
  }
  const { data, error } = await createServiceClient().rpc("convert_lead_to_client", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_existing_client_id: existingClientId,
    p_idempotency_key: `lead-convert:${context.clubId}:${leadId}`,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  const payload = rpcPayload(data)
  const duplicates = visibleDuplicates(payload, context.permissions)
  if (payload.status === "duplicate") {
    return {
      ok: false,
      error: duplicates.length > 0
        ? "Найден существующий клиент. Свяжите лид с ним или проверьте совпадение."
        : "Совпадающий клиент уже есть, но у вас нет прав на просмотр его данных.",
      code: "duplicate",
      duplicates,
    }
  }
  if (typeof payload.client_id !== "string") return { ok: false, error: "Сервер не вернул клиента." }
  refreshLeads()
  revalidatePath("/clients")
  return {
    ok: true,
    clientId: payload.client_id,
    mode: payload.mode === "existing_client" ? "existing_client" : "new_client",
  }
}

export async function archiveLeadAction(input: {
  leadId: string
  expectedVersion: number
  reason?: string | null
}): Promise<ActionResult> {
  const context = await getLeadActionContext("archive")
  if ("error" in context) return { ok: false, error: context.error }
  const leadId = requiredUuid(input.leadId)
  const expectedVersion = positiveVersion(input.expectedVersion)
  if (!leadId || !expectedVersion) return { ok: false, error: "Некорректный лид." }
  const { error } = await createServiceClient().rpc("archive_lead", {
    p_club_id: context.clubId,
    p_lead_id: leadId,
    p_actor_staff_id: context.staffId,
    p_reason: cleanMultiline(input.reason, 1_000),
    p_expected_version: expectedVersion,
  })
  if (error) return { ok: false, error: mapRpcError(error.message), code: error.code }
  refreshLeads()
  return { ok: true }
}

export async function duplicateLeadAction(input: CreateLeadInput): Promise<ActionResult<{ leadId: string; version: number }>> {
  return createLeadAction({ ...input, allowDuplicate: true })
}
