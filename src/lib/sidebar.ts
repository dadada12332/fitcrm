import { createClient } from "@/lib/supabase/server"

export type SidebarStats = {
  clientCount: number
  activeMembershipCount: number
  todayVisits: number
  lowStockCount: number
  userName: string
  userRole: string
  trialDaysLeft: number | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Менеджер",
  admin: "Администратор",
  trainer: "Тренер",
}

export async function getSidebarStats(clubId: string, userId: string, trialExpiresAt: string | null): Promise<SidebarStats> {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [clients, memberships, visits, stock, userRes, staffRow] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active"),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("inventory").select("quantity, min_quantity").eq("club_id", clubId),
    supabase.from("users").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("staff").select("role").eq("user_id", userId).eq("club_id", clubId).maybeSingle(),
  ])

  const lowStockCount = (stock.data ?? []).filter(
    (i: any) => Number(i.quantity) <= Number(i.min_quantity) && Number(i.min_quantity) > 0
  ).length

  const trialDaysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return {
    clientCount: clients.count ?? 0,
    activeMembershipCount: memberships.count ?? 0,
    todayVisits: visits.count ?? 0,
    lowStockCount,
    userName: (userRes.data as any)?.full_name ?? "Пользователь",
    userRole: ROLE_LABELS[(staffRow.data as any)?.role ?? ""] ?? "Сотрудник",
    trialDaysLeft,
  }
}
