import { Bot, InlineKeyboard } from "grammy"
import { createServiceClient } from "@/lib/supabase/service"
import { withPlatformCronRun } from "@/lib/platform-cron"
import {
  buildSubscriptionReminderIdempotencyKey,
  canReclaimSubscriptionReminder,
  renderSubscriptionReminder,
  resolveReminderClubSubscription,
  resolveSubscriptionReminderMilestone,
  safeSubscriptionTimeZone,
  subscriptionReminderLeaseCutoff,
} from "./helpers"

export const runtime = "nodejs"

type ClubRow = {
  id: string
  name: string
  plan: string
  trial_expires_at: string | null
  plan_expires_at: string | null
  settings: Record<string, unknown> | null
  plans: { code: string; is_trial: boolean } | Array<{ code: string; is_trial: boolean }> | null
}

type OwnerLinkRow = {
  club_id: string
  telegram_id: number | string
  staff: {
    club_id: string
    role: string
    is_active: boolean
  } | null
}

type ReminderEvent = {
  id: string
  status: "processing" | "sent" | "failed" | "received"
  created_at: string
}

function subscriptionUrl(clubId: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const origin = configured || (vercelHost ? `https://${vercelHost}` : "https://fitcrm-three.vercel.app")
  const query = new URLSearchParams({ club: clubId, next: "/settings/subscription" })
  return `${origin}/select-club?${query.toString()}`
}

export async function claimReminderEvent(input: {
  db: ReturnType<typeof createServiceClient>
  clubId: string
  telegramId: number
  idempotencyKey: string
  metadata: Record<string, unknown>
  now: Date
}): Promise<string | null> {
  const { data: existing, error: existingError } = await input.db
    .from("telegram_events")
    .select("id, status, created_at")
    .eq("club_id", input.clubId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()

  if (existingError) return null
  if (existing) {
    const event = existing as ReminderEvent
    if (!canReclaimSubscriptionReminder(event.status, event.created_at, input.now)) return null

    const claimedAt = input.now.toISOString()
    const reclaim = input.db
      .from("telegram_events")
      .update({ status: "processing", error_message: null, created_at: claimedAt })
      .eq("id", event.id)
      .eq("club_id", input.clubId)
      .eq("status", event.status)

    if (event.status === "processing") {
      reclaim.lt("created_at", subscriptionReminderLeaseCutoff(input.now))
    }

    const { data: reclaimed } = await reclaim
      .select("id")
      .maybeSingle()
    return reclaimed?.id ?? null
  }

  const { data: event, error } = await input.db
    .from("telegram_events")
    .insert({
      club_id: input.clubId,
      telegram_id: input.telegramId,
      event_type: "platform_subscription_reminder",
      status: "processing",
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata,
      created_at: input.now.toISOString(),
    })
    .select("id")
    .single()

  return error ? null : event?.id ?? null
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  return withPlatformCronRun("subscription_reminders", async () => {
    const db = createServiceClient()
    const now = new Date()
    // This platform cron intentionally enumerates configured bots first. Their
    // club IDs become the explicit tenant allow-list for every subsequent read.
    const { data: integrations, error: integrationsError } = await db
      .from("telegram_integrations")
      .select("club_id, bot_token")

    if (integrationsError) {
      return Response.json({ error: "Could not load Telegram integrations" }, { status: 500 })
    }
    if (!integrations?.length) {
      return Response.json({ ok: true, clubs: 0, sent: 0, failed: 0, skipped: 0 })
    }

    const tokenByClub = new Map<string, string>()
    for (const integration of integrations) {
      if (integration.club_id && integration.bot_token) {
        tokenByClub.set(integration.club_id, integration.bot_token)
      }
    }
    const integrationClubIds = [...tokenByClub.keys()]

    const [clubsResult, ownersResult, pendingResult] = await Promise.all([
      db
        .from("clubs")
        .select("id, name, plan, trial_expires_at, plan_expires_at, settings, plans(code, is_trial)")
        .in("id", integrationClubIds)
        .eq("status", "active"),
      db
        .from("telegram_users")
        .select("club_id, telegram_id, staff:staff_id(club_id, role, is_active)")
        .in("club_id", integrationClubIds)
        .not("staff_id", "is", null),
      db
        .from("platform_billing_requests")
        .select("club_id")
        .in("club_id", integrationClubIds)
        .eq("status", "pending"),
    ])

    if (clubsResult.error || ownersResult.error || pendingResult.error) {
      return Response.json({ error: "Could not load subscription reminder data" }, { status: 500 })
    }

    const activeClubIds = new Set((clubsResult.data ?? []).map((club) => club.id))
    const ownersByClub = new Map<string, Set<number>>()
    for (const rawLink of ownersResult.data ?? []) {
      const link = rawLink as unknown as OwnerLinkRow
      const telegramId = Number(link.telegram_id)
      if (
        !activeClubIds.has(link.club_id)
        || !link.staff?.is_active
        || link.staff.role !== "owner"
        || link.staff.club_id !== link.club_id
        || !Number.isSafeInteger(telegramId)
      ) continue

      const owners = ownersByClub.get(link.club_id) ?? new Set<number>()
      owners.add(telegramId)
      ownersByClub.set(link.club_id, owners)
    }
    const pendingClubs = new Set((pendingResult.data ?? []).map((requestRow) => requestRow.club_id))

    let eligibleClubs = 0
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const rawClub of clubsResult.data ?? []) {
      const club = rawClub as ClubRow
      const token = tokenByClub.get(club.id)
      const owners = ownersByClub.get(club.id)
      const lifecycle = resolveReminderClubSubscription({
        legacyPlan: club.plan,
        trialExpiresAt: club.trial_expires_at,
        planExpiresAt: club.plan_expires_at,
        relatedPlan: club.plans,
      })
      const expiresAt = lifecycle.expiresAt
      if (!token || !owners?.size || !expiresAt) {
        skipped += 1
        continue
      }

      const settings = club.settings ?? {}
      const timeZone = safeSubscriptionTimeZone(settings.timezone)
      const milestone = resolveSubscriptionReminderMilestone(expiresAt, now, timeZone)
      if (milestone === null) continue
      eligibleClubs += 1

      const hasPendingRequest = pendingClubs.has(club.id)
      const reminder = renderSubscriptionReminder({
        clubName: club.name,
        expiresAt,
        milestone,
        timeZone,
        locale: settings.communication_language,
        pendingRequest: hasPendingRequest,
        now,
      })
      const keyboard = new InlineKeyboard().url(reminder.cta, subscriptionUrl(club.id))
      const bot = new Bot(token)

      for (const telegramId of owners) {
        const idempotencyKey = buildSubscriptionReminderIdempotencyKey(expiresAt, milestone, telegramId)
        const eventId = await claimReminderEvent({
          db,
          clubId: club.id,
          telegramId,
          idempotencyKey,
          metadata: {
            expires_at: new Date(expiresAt).toISOString(),
            milestone,
            plan: lifecycle.plan,
            pending_request: hasPendingRequest,
            time_zone: timeZone,
            locale: reminder.locale,
          },
          now: new Date(),
        })

        if (!eventId) {
          skipped += 1
          continue
        }

        try {
          await bot.api.sendMessage(telegramId, reminder.message, { reply_markup: keyboard })
          const { error } = await db
            .from("telegram_events")
            .update({ status: "sent" })
            .eq("id", eventId)
            .eq("club_id", club.id)
          if (error) throw error
          sent += 1
        } catch (error) {
          await db
            .from("telegram_events")
            .update({
              status: "failed",
              error_message: error instanceof Error
                ? error.message.slice(0, 500)
                : "Telegram delivery failed",
            })
            .eq("id", eventId)
            .eq("club_id", club.id)
          failed += 1
        }
      }
    }

    return Response.json({ ok: true, clubs: eligibleClubs, sent, failed, skipped })
  })
}
