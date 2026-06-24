"use server"

import { createClient } from "@/lib/supabase/server"

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
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, subscriptions(status, memberships(name))")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8)

  return (data ?? []).map((c: any) => {
    const subs: any[] = c.subscriptions ?? []
    const sub = subs.find((s: any) => s.status === "active") ?? subs[0] ?? null
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone ?? null,
      membershipName: sub?.memberships?.name ?? null,
      status: sub?.status ?? null,
    }
  })
}

export async function getNotificationsAction(): Promise<AppNotification[]> {
  const supabase = await createClient()
  const now = new Date()
  const in7 = new Date(now); in7.setDate(now.getDate() + 7)
  const ago7 = new Date(now); ago7.setDate(now.getDate() - 7)

  const [expiringRes, expiredRes, pendingRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name)")
      .eq("status", "active")
      .gte("expires_at", now.toISOString().slice(0, 10))
      .lte("expires_at", in7.toISOString().slice(0, 10))
      .limit(10),
    supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name)")
      .eq("status", "expired")
      .gte("expires_at", ago7.toISOString().slice(0, 10))
      .limit(10),
    supabase
      .from("payments")
      .select("id, amount, clients(id, full_name)")
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
