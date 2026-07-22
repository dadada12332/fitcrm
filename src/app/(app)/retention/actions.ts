"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { can } from "@/lib/permissions"
import { getCurrentClub } from "@/lib/club"
import { getAuthUser } from "@/lib/auth"
import { getClientsForExport } from "@/lib/clients"
import { buildRetentionData } from "@/lib/retention"
import {
  buildRetentionAiAnalysis,
  matchesRetentionFilter,
  type RetentionAiAnalysis,
  type RetentionAiPriority,
  type RetentionAiScope,
  type RetentionClientActivity,
  type RetentionInteraction,
  type RetentionWorkflow,
} from "@/lib/retention-ai"
import { createServiceClient } from "@/lib/supabase/service"
import { callTelegramApi } from "@/lib/telegram/api"
import { consumeMonthlyLimit, requirePlanFeature, requirePlanSection } from "@/lib/plan-enforcement"

const MODEL = "gemini-2.5-flash"
const scopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("portfolio"),
    filter: z.enum(["all", "critical", "high", "medium", "expiring", "inactive", "debt", "expired", "frozen"]),
  }),
  z.object({ kind: z.literal("client"), clientId: z.string().uuid() }),
])

type ActivityVisit = { client_id: string; checked_in_at: string }
type ActivityPayment = { client_id: string | null; amount: number | string | null; paid_at: string | null }
type ActivitySubscription = { client_id: string }
type WorkflowCaseRow = {
  id: string
  client_id: string
  status: RetentionWorkflow["status"]
  next_follow_up_at: string | null
  last_interaction_at: string | null
  close_reason: string | null
}
type WorkflowInteractionRow = {
  id: string
  client_id: string
  channel: RetentionInteraction["channel"]
  kind: RetentionInteraction["kind"]
  outcome: string | null
  message: string | null
  created_at: string
  staff: { users: { full_name: string | null } | Array<{ full_name: string | null }> | null } | Array<{ users: { full_name: string | null } | Array<{ full_name: string | null }> | null }> | null
}

function buildActivity(
  clientIds: string[],
  visits: ActivityVisit[],
  payments: ActivityPayment[],
  subscriptions: ActivitySubscription[],
  now = new Date(),
) {
  const result: Record<string, RetentionClientActivity> = Object.fromEntries(clientIds.map((id) => [id, {
    visits30: 0,
    previousVisits30: 0,
    paid180: 0,
    lastPaymentAt: null,
    subscriptionsCount: 0,
  }]))
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000
  const sixtyDaysAgo = now.getTime() - 60 * 86_400_000

  for (const visit of visits) {
    const item = result[visit.client_id]
    if (!item) continue
    const timestamp = new Date(visit.checked_in_at).getTime()
    if (timestamp >= thirtyDaysAgo) item.visits30 += 1
    else if (timestamp >= sixtyDaysAgo) item.previousVisits30 += 1
  }
  for (const payment of payments) {
    if (!payment.client_id) continue
    const item = result[payment.client_id]
    if (!item) continue
    item.paid180 += Number(payment.amount ?? 0)
    if (payment.paid_at && (!item.lastPaymentAt || payment.paid_at > item.lastPaymentAt)) item.lastPaymentAt = payment.paid_at
  }
  for (const subscription of subscriptions) {
    const item = result[subscription.client_id]
    if (item) item.subscriptionsCount += 1
  }
  return result
}

function shortText(value: unknown, fallback: string, max = 500) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback
}

function parseAiEnhancement(value: unknown, fallback: RetentionAiAnalysis): RetentionAiAnalysis {
  if (!value || typeof value !== "object") return fallback
  const record = value as Record<string, unknown>
  const allowed = new Map(fallback.priorities.map((priority) => [priority.clientId, priority]))
  const priorities = Array.isArray(record.priorities)
    ? record.priorities.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return []
        const item = raw as Record<string, unknown>
        const current = allowed.get(String(item.clientId ?? ""))
        if (!current) return []
        return [{
          ...current,
          rationale: shortText(item.rationale, current.rationale),
          nextAction: shortText(item.nextAction, current.nextAction, 300),
          messageDraft: shortText(item.messageDraft, current.messageDraft, 600),
        } satisfies RetentionAiPriority]
      })
    : []

  return {
    ...fallback,
    source: "ai",
    summary: shortText(record.summary, fallback.summary, 700),
    confidenceNote: shortText(record.confidenceNote, fallback.confidenceNote, 300),
    priorities: fallback.priorities.map((priority) => priorities.find((item) => item.clientId === priority.clientId) ?? priority),
  }
}

async function enhanceWithGemini(analysis: RetentionAiAnalysis) {
  const key = process.env.GEMINI_API_KEY
  if (!key || analysis.metrics.selected === 0) return analysis

  const payload = {
    scope: analysis.scope,
    metrics: analysis.metrics,
    drivers: analysis.drivers.map(({ label, count, share }) => ({ label, count, share })),
    priorities: analysis.priorities.map(({ clientId, name, score, reasons, facts, rationale, nextAction, messageDraft }) => ({
      clientId, name, score, reasons, facts, rationale, nextAction, messageDraft,
    })),
  }
  const prompt = [
    "Ты CRM-копилот фитнес-клуба по удержанию клиентов.",
    "Верни только JSON-объект: summary, confidenceNote, priorities.",
    "В priorities сохрани только переданные clientId и для каждого верни clientId, rationale, nextAction, messageDraft.",
    "Не выдумывай факты, скидки и обещания. Пиши по-русски, конкретно и доброжелательно.",
    "Черновик сообщения не должен раскрывать внутренний риск-скоринг или звучать как слежка.",
    JSON.stringify(payload),
  ].join("\n")

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return analysis
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
    if (!text) return analysis
    return parseAiEnhancement(JSON.parse(text), analysis)
  } catch {
    return analysis
  }
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function attachContactWorkflow(service: ReturnType<typeof createServiceClient>, clubId: string, analysis: RetentionAiAnalysis) {
  const clientIds = analysis.priorities.map((priority) => priority.clientId)
  if (!clientIds.length) return analysis

  const [clientsResult, integrationResult, casesResult, interactionsResult] = await Promise.all([
    service.from("clients").select("id, phone, telegram_id").eq("club_id", clubId).in("id", clientIds),
    service.from("telegram_integrations").select("club_id").eq("club_id", clubId).maybeSingle(),
    service.from("retention_cases").select("id, client_id, status, next_follow_up_at, last_interaction_at, close_reason").eq("club_id", clubId).in("client_id", clientIds),
    service.from("client_interactions").select("id, client_id, channel, kind, outcome, message, created_at, staff(users(full_name))")
      .eq("club_id", clubId).in("client_id", clientIds).order("created_at", { ascending: false }).limit(60),
  ])
  const clients = new Map((clientsResult.data ?? []).map((client) => [client.id, client]))
  const cases = new Map(((casesResult.data ?? []) as WorkflowCaseRow[]).map((item) => [item.client_id, item]))
  const history = new Map<string, RetentionInteraction[]>()
  for (const row of (interactionsResult.data ?? []) as WorkflowInteractionRow[]) {
    const staff = relationOne(row.staff)
    const user = relationOne(staff?.users)
    const items = history.get(row.client_id) ?? []
    if (items.length >= 6) continue
    items.push({
      id: row.id,
      channel: row.channel,
      kind: row.kind,
      outcome: row.outcome,
      message: row.message,
      createdAt: row.created_at,
      staffName: user?.full_name ?? null,
    })
    history.set(row.client_id, items)
  }

  return {
    ...analysis,
    priorities: analysis.priorities.map((priority) => {
      const client = clients.get(priority.clientId)
      const caseRow = cases.get(priority.clientId)
      const hasTelegram = Boolean(client?.telegram_id && integrationResult.data)
      return {
        ...priority,
        contact: {
          phone: client?.phone ?? null,
          telegramAvailable: hasTelegram,
          telegramReason: hasTelegram
            ? null
            : !integrationResult.data
              ? "Сначала подключите Telegram-бота клуба"
              : !client?.telegram_id
                ? "Клиент ещё не запустил и не привязал бота"
                : "Telegram недоступен",
        },
        workflow: caseRow ? {
          caseId: caseRow.id,
          status: caseRow.status,
          nextFollowUpAt: caseRow.next_follow_up_at,
          lastInteractionAt: caseRow.last_interaction_at,
          closeReason: caseRow.close_reason,
          interactions: history.get(priority.clientId) ?? [],
        } satisfies RetentionWorkflow : null,
      }
    }),
  }
}

export async function analyzeRetentionAction(input: RetentionAiScope, useAiEnhancement = true): Promise<{ analysis?: RetentionAiAnalysis; error?: string }> {
  const parsed = scopeSchema.safeParse(input)
  if (!parsed.success) return { error: "Некорректный запрос анализа" }

  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (requirePlanSection(club, "retention") || requirePlanFeature(club, "retention")) return { error: "Удержание недоступно на текущем тарифе" }
  if (!can(club.permissions, "ai", "use") || !can(club.permissions, "reports", "view") || !can(club.permissions, "clients", "view")) {
    return { error: "Недостаточно прав для AI-разбора" }
  }
  const usageError = await consumeMonthlyLimit(club, "ai_requests")
  if (usageError) return { error: usageError }

  const service = createServiceClient()
  const [clients, membershipsResult] = await Promise.all([
    getClientsForExport(service, club.clubId, {}),
    service.from("memberships").select("name, price").eq("club_id", club.clubId),
  ])
  const prices = Object.fromEntries((membershipsResult.data ?? []).map((membership) => [membership.name, Number(membership.price ?? 0)]))
  const retention = buildRetentionData(clients, prices)
  const scope = parsed.data
  const scopedCandidates = scope.kind === "client"
    ? retention.candidates.filter((candidate) => candidate.id === scope.clientId)
    : retention.candidates.filter((candidate) => matchesRetentionFilter(candidate, scope.filter))
  const clientIds = scopedCandidates.slice(0, scope.kind === "client" ? 1 : 20).map((candidate) => candidate.id)

  let activity: Record<string, RetentionClientActivity> = {}
  if (clientIds.length) {
    const sinceVisits = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const sincePayments = new Date(Date.now() - 180 * 86_400_000).toISOString()
    const [visitsResult, paymentsResult, subscriptionsResult] = await Promise.all([
      service.from("visits").select("client_id, checked_in_at").eq("club_id", club.clubId).in("client_id", clientIds).gte("checked_in_at", sinceVisits).limit(5000),
      service.from("payments").select("client_id, amount, paid_at").eq("club_id", club.clubId).in("client_id", clientIds).eq("status", "paid").gte("paid_at", sincePayments).limit(5000),
      service.from("subscriptions").select("client_id").eq("club_id", club.clubId).in("client_id", clientIds).limit(1000),
    ])
    activity = buildActivity(
      clientIds,
      (visitsResult.data ?? []) as ActivityVisit[],
      (paymentsResult.data ?? []) as ActivityPayment[],
      (subscriptionsResult.data ?? []) as ActivitySubscription[],
    )
  }

  const fallback = buildRetentionAiAnalysis(retention, scope, activity)
  if (!fallback) return { error: "Клиент не найден в очереди удержания" }
  const enriched = await attachContactWorkflow(service, club.clubId, fallback)
  return { analysis: useAiEnhancement ? await enhanceWithGemini(enriched) : enriched }
}

const outreachSchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
})
const manualOutreachSchema = outreachSchema.extend({ channel: z.enum(["phone", "copy"]) })
const outcomeSchema = z.object({
  clientId: z.string().uuid(),
  outcome: z.enum(["no_answer", "interested", "renewing", "returned", "declined", "follow_up"]),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).optional(),
})

type MutationContext = {
  club: NonNullable<Awaited<ReturnType<typeof getCurrentClub>>>
  clubId: string
  userId: string
  staffId: string
  client: { id: string; full_name: string; phone: string | null; telegram_id: number | string | null }
  service: ReturnType<typeof createServiceClient>
}

async function getMutationContext(clientId: string, telegram = false): Promise<{ ctx?: MutationContext; error?: string }> {
  const [club, user] = await Promise.all([getCurrentClub(), getAuthUser()])
  if (!club || !user) return { error: "Не авторизован" }
  if (requirePlanSection(club, "retention") || requirePlanFeature(club, "retention")) return { error: "Удержание недоступно на текущем тарифе" }
  if (!can(club.permissions, "clients", "edit")) return { error: "Недостаточно прав для контакта с клиентом" }
  if (telegram && !can(club.permissions, "telegram", "view")) return { error: "Недостаточно прав для Telegram" }

  const service = createServiceClient()
  const [{ data: client }, { data: staff }] = await Promise.all([
    service.from("clients").select("id, full_name, phone, telegram_id").eq("club_id", club.clubId).eq("id", clientId).maybeSingle(),
    service.from("staff").select("id").eq("club_id", club.clubId).eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ])
  if (!client) return { error: "Клиент не найден" }
  if (!staff) return { error: "Сотрудник не найден в текущем клубе" }
  return { ctx: { club, clubId: club.clubId, userId: user.id, staffId: staff.id, client, service } }
}

async function ensureRetentionCase(ctx: MutationContext, status: RetentionWorkflow["status"] = "contacted") {
  const now = new Date().toISOString()
  const { data: existing } = await ctx.service.from("retention_cases")
    .select("id, status").eq("club_id", ctx.clubId).eq("client_id", ctx.client.id).maybeSingle()
  const reopening = existing?.status === "won" || existing?.status === "lost"
  const payload = {
    club_id: ctx.clubId,
    client_id: ctx.client.id,
    assigned_staff_id: ctx.staffId,
    status,
    last_interaction_at: now,
    updated_at: now,
    created_by: ctx.userId,
    ...(reopening ? { opened_at: now, closed_at: null, close_reason: null, next_follow_up_at: null } : {}),
  }
  const { data, error } = await ctx.service.from("retention_cases").upsert(payload, { onConflict: "club_id,client_id" }).select("id").single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function addInteraction(ctx: MutationContext, values: {
  caseId: string
  channel: RetentionInteraction["channel"]
  kind: RetentionInteraction["kind"]
  outcome?: string | null
  message?: string | null
  nextFollowUpAt?: string | null
  metadata?: Record<string, unknown>
}) {
  const { error } = await ctx.service.from("client_interactions").insert({
    club_id: ctx.clubId,
    client_id: ctx.client.id,
    case_id: values.caseId,
    staff_id: ctx.staffId,
    source: "retention",
    channel: values.channel,
    kind: values.kind,
    outcome: values.outcome ?? null,
    message: values.message ?? null,
    next_follow_up_at: values.nextFollowUpAt ?? null,
    metadata: values.metadata ?? {},
    created_by: ctx.userId,
  })
  if (error) throw new Error(error.message)
}

export async function sendRetentionTelegramAction(input: { clientId: string; message: string }): Promise<{ ok?: boolean; warning?: string; error?: string }> {
  const parsed = outreachSchema.safeParse(input)
  if (!parsed.success) return { error: "Проверьте текст сообщения" }
  const { ctx, error } = await getMutationContext(parsed.data.clientId, true)
  if (!ctx) return { error }
  if (!ctx.client.telegram_id) return { error: "Клиент ещё не привязал Telegram-бота" }

  const { data: integration } = await ctx.service.from("telegram_integrations").select("bot_token").eq("club_id", ctx.clubId).maybeSingle()
  if (!integration?.bot_token) return { error: "Telegram-бот клуба не подключён" }
  const usageError = await consumeMonthlyLimit(ctx.club, "telegram_messages")
  if (usageError) return { error: usageError }
  const response = await callTelegramApi(integration.bot_token, "sendMessage", { chat_id: ctx.client.telegram_id, text: parsed.data.message })
  if (!response.ok) return { error: response.description ?? "Telegram не принял сообщение" }

  try {
    const caseId = await ensureRetentionCase(ctx)
    await addInteraction(ctx, { caseId, channel: "telegram", kind: "outreach", outcome: "sent", message: parsed.data.message })
  } catch (historyError) {
    return { ok: true, warning: `Сообщение отправлено, но история не сохранена: ${historyError instanceof Error ? historyError.message : "ошибка"}` }
  }
  revalidatePath("/retention")
  return { ok: true }
}

export async function logRetentionOutreachAction(input: { clientId: string; message: string; channel: "phone" | "copy" }): Promise<{ ok?: boolean; phone?: string | null; error?: string }> {
  const parsed = manualOutreachSchema.safeParse(input)
  if (!parsed.success) return { error: "Некорректные данные контакта" }
  const { ctx, error } = await getMutationContext(parsed.data.clientId)
  if (!ctx) return { error }
  try {
    const caseId = await ensureRetentionCase(ctx)
    await addInteraction(ctx, {
      caseId,
      channel: parsed.data.channel,
      kind: "outreach",
      outcome: "opened",
      message: parsed.data.message,
    })
  } catch (interactionError) {
    return { error: interactionError instanceof Error ? interactionError.message : "Не удалось сохранить контакт" }
  }
  revalidatePath("/retention")
  return { ok: true, phone: ctx.client.phone }
}

export async function recordRetentionOutcomeAction(input: {
  clientId: string
  outcome: "no_answer" | "interested" | "renewing" | "returned" | "declined" | "follow_up"
  nextFollowUpAt?: string | null
  note?: string
}): Promise<{ ok?: boolean; error?: string }> {
  const parsed = outcomeSchema.safeParse(input)
  if (!parsed.success) return { error: "Проверьте результат контакта" }
  const { ctx, error } = await getMutationContext(parsed.data.clientId)
  if (!ctx) return { error }
  const followUpAt = parsed.data.nextFollowUpAt ?? (parsed.data.outcome === "no_answer"
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    : null)
  if (parsed.data.outcome === "follow_up" && !followUpAt) return { error: "Укажите дату следующего контакта" }
  if (followUpAt && new Date(followUpAt).getTime() <= Date.now()) return { error: "Следующий контакт должен быть в будущем" }

  const status: RetentionWorkflow["status"] = parsed.data.outcome === "returned"
    ? "won"
    : parsed.data.outcome === "declined"
      ? "lost"
      : followUpAt || parsed.data.outcome === "follow_up" || parsed.data.outcome === "no_answer"
        ? "follow_up"
        : "contacted"
  try {
    const caseId = await ensureRetentionCase(ctx, status)
    const now = new Date().toISOString()
    const { error: updateError } = await ctx.service.from("retention_cases").update({
      status,
      next_follow_up_at: status === "follow_up" ? followUpAt : null,
      closed_at: status === "won" || status === "lost" ? now : null,
      close_reason: status === "won" ? "manual_return" : status === "lost" ? "declined" : null,
      last_interaction_at: now,
      updated_at: now,
    }).eq("id", caseId).eq("club_id", ctx.clubId)
    if (updateError) throw new Error(updateError.message)
    await addInteraction(ctx, {
      caseId,
      channel: "system",
      kind: "outcome",
      outcome: parsed.data.outcome,
      message: parsed.data.note || null,
      nextFollowUpAt: followUpAt,
    })
  } catch (outcomeError) {
    return { error: outcomeError instanceof Error ? outcomeError.message : "Не удалось сохранить результат" }
  }
  revalidatePath("/retention")
  return { ok: true }
}
