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
}

const ROLE_LABELS: Record<string, string> = {
  owner:   "Владелец",
  manager: "Менеджер",
  admin:   "Администратор",
  trainer: "Тренер",
}

export async function getSidebarStats(clubId: string, userId: string, trialExpiresAt: string | null): Promise<SidebarStats> {
  const supabase = await createClient()
  const authUser = await getAuthUser()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [clients, memberships, visits, stock, userRes, staffRow, supportRows] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active"),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("inventory").select("quantity, min_quantity").eq("club_id", clubId),
    supabase.from("users").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("staff").select("id, role").eq("user_id", userId).eq("club_id", clubId).maybeSingle(),
    supabase.from("support_tickets").select("agent_last_read_at, user_last_read_at").eq("club_id", clubId).not("agent_last_read_at", "is", null),
  ])

  const lowStockCount = (stock.data ?? []).filter(
    (i: any) => Number(i.quantity) <= Number(i.min_quantity) && Number(i.min_quantity) > 0
  ).length

  const supportUnread = (supportRows.data ?? []).filter(
    (t: any) => t.agent_last_read_at && new Date(t.agent_last_read_at) > new Date(t.user_last_read_at)
  ).length

  const trialDaysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const meta = authUser?.user_metadata ?? {}

  return {
    clientCount:           clients.count ?? 0,
    activeMembershipCount: memberships.count ?? 0,
    todayVisits:           visits.count ?? 0,
    lowStockCount,
    userName:     (userRes.data as any)?.full_name ?? "Пользователь",
    userRole:     ROLE_LABELS[(staffRow.data as any)?.role ?? ""] ?? "Сотрудник",
    trialDaysLeft,
    staffId:      (staffRow.data as any)?.id ?? null,
    avatarPreset: (meta.avatar_preset as string) ?? null,
    avatarUrl:    (meta.avatar_url    as string) ?? null,
    supportUnread,
  }
}
