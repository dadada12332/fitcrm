"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import {
  GROWTH_EXPERIMENT_CATALOG,
  mapGrowthExperimentRun,
  type GrowthExperimentRun,
  type GrowthExperimentRunRow,
} from "@/lib/growth"
import { can } from "@/lib/permissions"
import { createServiceClient } from "@/lib/supabase/service"

type Result = { run?: GrowthExperimentRun; error?: string }
type MutationContext =
  | { ok: true; club: NonNullable<Awaited<ReturnType<typeof getCurrentClub>>>; user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; service: ReturnType<typeof createServiceClient> }
  | { ok: false; error: string }

const startSchema = z.object({
  experimentId: z.string().trim().min(1).max(80),
  audienceSize: z.number().int().min(0).max(1_000_000),
  message: z.string().trim().min(1).max(2000),
})

const completeSchema = z.object({
  runId: z.string().uuid(),
  result: z.enum(["won", "inconclusive", "lost"]),
  resultValue: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
})

async function mutationContext(): Promise<MutationContext> {
  const [club, user] = await Promise.all([getCurrentClub(), getAuthUser()])
  if (!club || !user) return { ok: false, error: "Не авторизован" }
  if (!can(club.permissions, "reports", "view") || !can(club.permissions, "clients", "view")) {
    return { ok: false, error: "Недостаточно прав для Growth OS" }
  }
  return { ok: true, club, user, service: createServiceClient() }
}

export async function startGrowthExperimentAction(input: {
  experimentId: string
  audienceSize: number
  message: string
}): Promise<Result> {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { error: "Проверьте параметры эксперимента" }
  const experiment = GROWTH_EXPERIMENT_CATALOG.find((item) => item.id === parsed.data.experimentId)
  if (!experiment) return { error: "Эксперимент не найден" }

  const context = await mutationContext()
  if (!context.ok) return { error: context.error }
  const { club, user, service } = context

  const { data: existing } = await service
    .from("growth_experiment_runs")
    .select("*")
    .eq("club_id", club.clubId)
    .eq("experiment_key", experiment.id)
    .eq("status", "active")
    .maybeSingle()
  if (existing) return { run: mapGrowthExperimentRun(existing as GrowthExperimentRunRow) }

  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + experiment.durationDays * 86_400_000)
  const { data, error } = await service.from("growth_experiment_runs").insert({
    club_id: club.clubId,
    experiment_key: experiment.id,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    primary_metric: experiment.metric,
    expected_impact: experiment.expectedImpact,
    duration_days: experiment.durationDays,
    playbook_id: experiment.playbookId,
    message: parsed.data.message,
    audience_size: parsed.data.audienceSize,
    status: "active",
    started_at: startedAt.toISOString(),
    ends_at: endsAt.toISOString(),
    created_by: user.id,
  }).select("*").single()

  if (error || !data) return { error: error?.code === "23505" ? "Этот эксперимент уже запущен" : "Не удалось запустить эксперимент" }
  revalidatePath("/growth")
  return { run: mapGrowthExperimentRun(data as GrowthExperimentRunRow) }
}

export async function completeGrowthExperimentAction(input: {
  runId: string
  result: "won" | "inconclusive" | "lost"
  resultValue?: string
  note?: string
}): Promise<Result> {
  const parsed = completeSchema.safeParse(input)
  if (!parsed.success) return { error: "Проверьте итог эксперимента" }
  const context = await mutationContext()
  if (!context.ok) return { error: context.error }
  const { club, service } = context

  const now = new Date().toISOString()
  const { data, error } = await service.from("growth_experiment_runs").update({
    status: "completed",
    completed_at: now,
    result: parsed.data.result,
    result_value: parsed.data.resultValue || null,
    result_note: parsed.data.note || null,
    updated_at: now,
  }).eq("id", parsed.data.runId).eq("club_id", club.clubId).eq("status", "active").select("*").maybeSingle()

  if (error || !data) return { error: "Активный эксперимент не найден" }
  revalidatePath("/growth")
  return { run: mapGrowthExperimentRun(data as GrowthExperimentRunRow) }
}

export async function cancelGrowthExperimentAction(runId: string): Promise<Result> {
  const parsed = z.string().uuid().safeParse(runId)
  if (!parsed.success) return { error: "Некорректный эксперимент" }
  const context = await mutationContext()
  if (!context.ok) return { error: context.error }
  const { club, service } = context

  const now = new Date().toISOString()
  const { data, error } = await service.from("growth_experiment_runs").update({
    status: "cancelled",
    completed_at: now,
    updated_at: now,
  }).eq("id", parsed.data).eq("club_id", club.clubId).eq("status", "active").select("*").maybeSingle()

  if (error || !data) return { error: "Активный эксперимент не найден" }
  revalidatePath("/growth")
  return { run: mapGrowthExperimentRun(data as GrowthExperimentRunRow) }
}
