"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type GlobalSearchResult = {
  id: string
  name: string
  phone: string | null
  membershipName: string | null
  status: string | null
}

export type AppNotification = {
  id: string
  type: "expiring" | "expired" | "pending"
  clientId: string
  clientName: string
  detail: string
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []

  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, subscriptions(status, memberships(name))")
    .eq("club_id", club.clubId)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8)

  return (data ?? []).map((c) => {
    const subs = (c.subscriptions as Array<{ status: string; memberships: { name: string }[] | null }>) ?? []
    const sub = subs.find((s) => s.status === "active") ?? subs[0] ?? null
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone ?? null,
      membershipName: Array.isArray(sub?.memberships) ? (sub.memberships[0]?.name ?? null) : null,
      status: sub?.status ?? null,
    }
  })
}

export async function getNotificationsAction(): Promise<AppNotification[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []

  const { clubId } = club
  const now  = new Date()
  const in7  = new Date(now); in7.setDate(now.getDate() + 7)
  const ago7 = new Date(now); ago7.setDate(now.getDate() - 7)

  const [expiringRes, expiredRes, pendingRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name)")
      .eq("club_id", clubId)
      .eq("status", "active")
      .gte("expires_at", now.toISOString().slice(0, 10))
      .lte("expires_at", in7.toISOString().slice(0, 10))
      .limit(10),
    supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name)")
      .eq("club_id", clubId)
      .eq("status", "expired")
      .gte("expires_at", ago7.toISOString().slice(0, 10))
      .limit(10),
    supabase
      .from("payments")
      .select("id, amount, clients(id, full_name)")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .limit(10),
  ])

  const result: AppNotification[] = []

  for (const sub of expiringRes.data ?? []) {
    const client = Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
    if (!client) continue
    const days = Math.ceil((new Date(sub.expires_at).getTime() - now.getTime()) / 86_400_000)
    result.push({
      id: `exp-${sub.id}`,
      type: "expiring",
      clientId: client.id,
      clientName: client.full_name,
      detail: days === 0 ? "истекает сегодня" : `истекает через ${days} дн.`,
    })
  }

  for (const sub of expiredRes.data ?? []) {
    const client = Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
    if (!client) continue
    result.push({
      id: `ed-${sub.id}`,
      type: "expired",
      clientId: client.id,
      clientName: client.full_name,
      detail: "абонемент истёк",
    })
  }

  for (const pay of pendingRes.data ?? []) {
    const client = Array.isArray(pay.clients) ? pay.clients[0] : pay.clients
    if (!client) continue
    result.push({
      id: `pay-${pay.id}`,
      type: "pending",
      clientId: client.id,
      clientName: client.full_name,
      detail: `${Number(pay.amount).toLocaleString("ru-RU")} сум`,
    })
  }

  return result
}

// ── Branch switcher ────────────────────────────────────────────────
export type Branch = { clubId: string; name: string; plan: string; role: string }

export async function getBranchesAction(): Promise<Branch[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("staff")
    .select("club_id, role, clubs(id, name, plan)")
    .eq("user_id", user.id)
    .eq("is_active", true)

  return (data ?? []).map((s) => ({
    clubId: s.club_id,
    role: s.role,
    name: (s.clubs as unknown as { name: string } | null)?.name ?? "Клуб",
    plan: (s.clubs as unknown as { plan: string } | null)?.plan ?? "",
  }))
}

export async function switchBranchAction(clubId: string): Promise<void> {
  const { cookies } = await import("next/headers")
  const store = await cookies()
  store.set("selected_club_id", clubId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" })
}
