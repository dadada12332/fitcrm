"use server"

import { z } from "zod"
import { can } from "@/lib/permissions"
import { getCurrentClub } from "@/lib/club"
import { getClientsForExport } from "@/lib/clients"
import { buildRetentionData } from "@/lib/retention"
import {
  buildRetentionAiAnalysis,
  matchesRetentionFilter,
  type RetentionAiAnalysis,
  type RetentionAiPriority,
  type RetentionAiScope,
  type RetentionClientActivity,
} from "@/lib/retention-ai"
import { createServiceClient } from "@/lib/supabase/service"

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

export async function analyzeRetentionAction(input: RetentionAiScope): Promise<{ analysis?: RetentionAiAnalysis; error?: string }> {
  const parsed = scopeSchema.safeParse(input)
  if (!parsed.success) return { error: "Некорректный запрос анализа" }

  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "ai", "use") || !can(club.permissions, "reports", "view") || !can(club.permissions, "clients", "view")) {
    return { error: "Недостаточно прав для AI-разбора" }
  }

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
  return { analysis: await enhanceWithGemini(fallback) }
}
