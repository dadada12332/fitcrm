import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/auth"

export type SidebarStats = {
  clientCount: number
  activeMembershipCount: number
  todayVisits: number
  lowStockCount: number
  userName: string
  userRole: string
  trialDaysLeft: number | null
  staffId: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  supportUnread: number
  notificationCount: number
}

const ROLE_LABELS: Record<string, string> = {
  owner:   "Владелец",
  manager: "Менеджер",
  admin:   "Администратор",
  trainer: "Тренер",
}

type SidebarRpc = Omit<SidebarStats, "trialDaysLeft" | "avatarPreset" | "avatarUrl">

export async function getSidebarStats(
  clubId: string,
  userId: string,
  trialExpiresAt: string | null,
  userMetadata: Record<string, unknown> = {},
): Promise<SidebarStats> {
  const supabase = await createClient()

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_sidebar_stats", { p_club_id: clubId })
  if (!rpcError && rpcData) {
    const data = rpcData as SidebarRpc
    return withLocalMeta(data, trialExpiresAt, userMetadata)
  }

  const authUser = Object.keys(userMetadata).length ? null : await getAuthUser()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)

  const [clients, memberships, visits, stock, userRes, staffRow, supportRows, expiring, expired, pendingPayments] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active"),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("inventory").select("quantity, min_quantity").eq("club_id", clubId),
    supabase.from("users").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("staff").select("id, role").eq("user_id", userId).eq("club_id", clubId).maybeSingle(),
    supabase.from("support_tickets").select("agent_last_read_at, user_last_read_at").eq("club_id", clubId).not("agent_last_read_at", "is", null),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active").gte("expires_at", todayStart.toISOString().slice(0, 10)).lte("expires_at", nextWeek.toISOString().slice(0, 10)),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "expired").gte("expires_at", lastWeek.toISOString().slice(0, 10)).lte("expires_at", todayStart.toISOString().slice(0, 10)),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
  ])

  const lowStockCount = (stock.data ?? []).filter(
    (i) => Number(i.quantity) <= Number(i.min_quantity) && Number(i.min_quantity) > 0
  ).length

  const supportUnread = (supportRows.data ?? []).filter(
    (t) => t.agent_last_read_at && new Date(t.agent_last_read_at) > new Date(t.user_last_read_at)
  ).length

  return withLocalMeta({
    clientCount:           clients.count ?? 0,
    activeMembershipCount: memberships.count ?? 0,
    todayVisits:           visits.count ?? 0,
    lowStockCount,
    userName:     userRes.data?.full_name ?? "Пользователь",
    userRole:     ROLE_LABELS[staffRow.data?.role ?? ""] ?? "Сотрудник",
    staffId:      staffRow.data?.id ?? null,
    supportUnread,
    notificationCount: Math.min(expiring.count ?? 0, 10) + Math.min(expired.count ?? 0, 10) + Math.min(pendingPayments.count ?? 0, 10),
  }, trialExpiresAt, Object.keys(userMetadata).length ? userMetadata : (authUser?.user_metadata ?? {}))
}

function withLocalMeta(data: SidebarRpc, trialExpiresAt: string | null, meta: Record<string, unknown>): SidebarStats {
  return {
    ...data,
    trialDaysLeft: trialExpiresAt
      ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / 86_400_000))
      : null,
    avatarPreset: (meta.avatar_preset as string) ?? null,
    avatarUrl: (meta.avatar_url as string) ?? null,
  }
}
