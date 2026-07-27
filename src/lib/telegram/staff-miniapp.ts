import { can } from "@/lib/permissions"
import { createServiceClient } from "@/lib/supabase/service"
import type { TelegramStaffActor } from "@/lib/telegram/actor"
import { zonedDayRange } from "@/lib/timezone"

type CountResult = { count: number | null }

function countValue(result: CountResult | null | undefined) {
  return result?.count ?? 0
}

function weekdayInTimeZone(timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date())
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday)
}

export async function buildTelegramStaffMiniApp(actor: TelegramStaffActor) {
  const service = createServiceClient()
  const { data: club } = await service
    .from("clubs")
    .select("name, city, settings")
    .eq("id", actor.clubId)
    .single()
  if (!club) return null

  const settings = (club.settings as Record<string, unknown> | null) ?? {}
  const timeZone = typeof settings.timezone === "string" ? settings.timezone : "Asia/Tashkent"
  const currency = typeof settings.currency === "string" ? settings.currency : "UZS"
  const { from, to } = zonedDayRange(new Date(), timeZone, 0)
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const inSevenDays = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 7 * 86_400_000))

  const mayViewClients = can(actor.permissions, "clients", "view")
  const mayViewMemberships = can(actor.permissions, "memberships", "view")
  const mayViewVisits = can(actor.permissions, "visits", "view")
  const mayViewSchedule = can(actor.permissions, "schedule", "view")
  const mayViewPayments = can(actor.permissions, "payments", "view")
  const mayViewFinance = can(actor.permissions, "dashboard", "view_finance")
    || can(actor.permissions, "payments", "view_revenue")
    || can(actor.permissions, "reports", "finance")
  const mayViewInbox = can(actor.permissions, "inbox", "view")

  const [
    clientsResult,
    subscriptionsResult,
    expiringResult,
    visitsResult,
    paymentsResult,
    pendingPaymentsResult,
    inboxResult,
  ] = await Promise.all([
    mayViewClients
      ? service.from("clients").select("id", { count: "exact", head: true }).eq("club_id", actor.clubId)
      : Promise.resolve(null),
    mayViewMemberships
      ? service.from("subscriptions").select("id", { count: "exact", head: true })
          .eq("club_id", actor.clubId).eq("status", "active")
      : Promise.resolve(null),
    mayViewMemberships
      ? service.from("subscriptions").select("id", { count: "exact", head: true })
          .eq("club_id", actor.clubId).eq("status", "active").gte("expires_at", today).lte("expires_at", inSevenDays)
      : Promise.resolve(null),
    mayViewVisits
      ? service.from("visits").select("id", { count: "exact", head: true })
          .eq("club_id", actor.clubId).gte("checked_in_at", from).lt("checked_in_at", to)
      : Promise.resolve(null),
    mayViewFinance
      ? service.from("payments").select("amount").eq("club_id", actor.clubId)
          .eq("status", "paid").gte("paid_at", from).lt("paid_at", to)
      : Promise.resolve(null),
    mayViewPayments
      ? service.from("payments").select("id", { count: "exact", head: true })
          .eq("club_id", actor.clubId).eq("status", "pending")
      : Promise.resolve(null),
    mayViewInbox
      ? service.from("client_conversations").select("id", { count: "exact", head: true })
          .eq("club_id", actor.clubId).in("status", ["new", "open", "waiting_client"])
      : Promise.resolve(null),
  ])

  let scheduleQuery = service
    .from("schedules")
    .select("id, title, start_time, end_time, trainer_name, rooms(name)")
    .eq("club_id", actor.clubId)
    .eq("day_of_week", weekdayInTimeZone(timeZone))
    .eq("is_active", true)
    .order("start_time")
    .limit(12)
  if (actor.role === "trainer") scheduleQuery = scheduleQuery.eq("staff_id", actor.staffId)
  const scheduleResult = mayViewSchedule ? await scheduleQuery : { data: [] }

  const revenue = mayViewFinance
    ? (paymentsResult?.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0)
    : undefined
  const schedule = (scheduleResult.data ?? []).map((item) => {
    const room = Array.isArray(item.rooms) ? item.rooms[0] : item.rooms
    return {
      id: item.id,
      title: item.title,
      startTime: item.start_time,
      endTime: item.end_time,
      trainerName: item.trainer_name,
      roomName: room?.name ?? null,
    }
  })

  return {
    actor: {
      kind: "staff" as const,
      role: actor.role,
      roleName: actor.roleName,
      fullName: actor.fullName,
      permissions: {
        clients: mayViewClients,
        memberships: mayViewMemberships,
        visits: mayViewVisits,
        checkin: can(actor.permissions, "visits", "checkin"),
        schedule: mayViewSchedule,
        payments: mayViewPayments,
        finance: mayViewFinance,
        inbox: mayViewInbox,
      },
    },
    club: { name: club.name, city: club.city, currency },
    stats: {
      clients: mayViewClients ? countValue(clientsResult) : undefined,
      activeMemberships: mayViewMemberships ? countValue(subscriptionsResult) : undefined,
      expiringMemberships: mayViewMemberships ? countValue(expiringResult) : undefined,
      visitsToday: mayViewVisits ? countValue(visitsResult) : undefined,
      revenueToday: revenue,
      pendingPayments: mayViewPayments ? countValue(pendingPaymentsResult) : undefined,
      openConversations: mayViewInbox ? countValue(inboxResult) : undefined,
      classesToday: mayViewSchedule ? schedule.length : undefined,
    },
    schedule,
    serverDate: today,
  }
}
