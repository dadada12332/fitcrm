"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { logPlatformAction, platformBase, requirePlatformPermission } from "@/lib/platform"

type Audience = { kind: "all" | "plan" | "status"; value?: string }
type Result = { ok?: boolean; error?: string; recipients?: number }

function validAudience(audience: Audience): boolean {
  if (audience.kind === "all") return true
  if (audience.kind === "plan") return ["trial", "starter", "standard", "business"].includes(audience.value ?? "")
  return audience.kind === "status" && ["active", "suspended", "expired"].includes(audience.value ?? "")
}

async function resolveOwnerRecipients(audience: Audience) {
  const db = createServiceClient()
  const [{ data: clubs, error: clubsError }, { data: owners, error: ownersError }] = await Promise.all([
    db.from("clubs").select("id, plan, status, trial_expires_at, plan_expires_at").neq("status", "deleted"),
    db.from("telegram_users")
      .select("telegram_id, club_id, staff:staff_id(role, is_active)")
      .not("staff_id", "is", null),
  ])
  if (clubsError || ownersError) throw clubsError ?? ownersError
  const now = Date.now()
  const eligible = new Set((clubs ?? []).filter((club) => {
    if (audience.kind === "plan") return club.plan === audience.value
    if (audience.kind === "status") {
      if (audience.value === "suspended") return club.status === "suspended"
      const expires = club.plan === "trial" ? club.trial_expires_at : club.plan_expires_at
      const expired = Boolean(expires && new Date(expires).getTime() <= now)
      return audience.value === "expired" ? expired : club.status === "active" && !expired
    }
    return true
  }).map((club) => club.id))

  return (owners ?? []).flatMap((owner) => {
    const staff = owner.staff as unknown as { role: string; is_active: boolean } | null
    if (!staff?.is_active || staff.role !== "owner" || !eligible.has(owner.club_id)) return []
    return [{ club_id: owner.club_id, telegram_id: Number(owner.telegram_id) }]
  })
}

async function refresh() {
  const base = await platformBase()
  revalidatePath(`${base}/broadcasts`)
}

export async function createPlatformBroadcastAction(input: {
  title: string
  body: string
  audience: Audience
  scheduledAt: string | null
}): Promise<Result> {
  const auth = await requirePlatformPermission("broadcasts.manage")
  const title = input.title.trim()
  const body = input.body.trim()
  if (title.length < 3 || title.length > 120) return { error: "Заголовок: от 3 до 120 символов" }
  if (body.length < 3 || body.length > 4000) return { error: "Сообщение: от 3 до 4000 символов" }
  if (!validAudience(input.audience)) return { error: "Некорректная аудитория" }
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date()
  if (Number.isNaN(scheduledAt.getTime())) return { error: "Некорректная дата отправки" }

  const db = createServiceClient()
  const recipients = await resolveOwnerRecipients(input.audience)
  if (!recipients.length) return { error: "В выбранной аудитории нет владельцев с подключённым Telegram" }

  const { data: campaign, error } = await db.from("platform_broadcasts").insert({
    title,
    body,
    audience: input.audience,
    status: "scheduled",
    scheduled_at: scheduledAt.toISOString(),
    recipient_count: recipients.length,
    created_by: auth.userId,
  }).select("id").single()
  if (error || !campaign) return { error: "Не удалось создать рассылку" }

  const { error: deliveriesError } = await db.from("platform_broadcast_deliveries").insert(
    recipients.map((recipient) => ({ broadcast_id: campaign.id, ...recipient })),
  )
  if (deliveriesError) {
    await db.from("platform_broadcasts").delete().eq("id", campaign.id)
    return { error: "Не удалось сформировать список получателей" }
  }
  await logPlatformAction({ action: "platform_broadcast_schedule", meta: { broadcastId: campaign.id, recipients: recipients.length, audience: input.audience } })
  await refresh()
  return { ok: true, recipients: recipients.length }
}

export async function cancelPlatformBroadcastAction(id: string): Promise<Result> {
  await requirePlatformPermission("broadcasts.manage")
  const db = createServiceClient()
  const { data, error } = await db.from("platform_broadcasts")
    .update({ status: "cancelled" })
    .eq("id", id).eq("status", "scheduled").select("id").maybeSingle()
  if (error || !data) return { error: "Рассылку уже нельзя отменить" }
  await db.from("platform_broadcast_deliveries").update({ status: "skipped" }).eq("broadcast_id", id).eq("status", "queued")
  await logPlatformAction({ action: "platform_broadcast_cancel", meta: { broadcastId: id } })
  await refresh()
  return { ok: true }
}
