"use server"

import { sanitizeSearchTerm } from "@/lib/search"
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
  title: string
  detail: string
  membershipName: string | null
  eventDate: string | null
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim()
  if (q.length < 1) return []

  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club || !club.permissions.clients.view) return []

  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, subscriptions(status, memberships(name))")
    .eq("club_id", club.clubId)
    .or(`full_name.ilike.%${sanitizeSearchTerm(q)}%,phone.ilike.%${sanitizeSearchTerm(q)}%`)
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

  const subscriptionQuery = club.permissions.clients.view || club.permissions.memberships.view
  const [expiringRes, expiredRes, pendingRes] = await Promise.all([
    subscriptionQuery ? supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name), memberships(name)")
      .eq("club_id", clubId)
      .eq("status", "active")
      .gte("expires_at", now.toISOString().slice(0, 10))
      .lte("expires_at", in7.toISOString().slice(0, 10))
      .order("expires_at", { ascending: true })
      .limit(10) : Promise.resolve({ data: [] }),
    subscriptionQuery ? supabase
      .from("subscriptions")
      .select("id, expires_at, clients(id, full_name), memberships(name)")
      .eq("club_id", clubId)
      .eq("status", "expired")
      .gte("expires_at", ago7.toISOString().slice(0, 10))
      .lte("expires_at", now.toISOString().slice(0, 10))
      .order("expires_at", { ascending: false })
      .limit(10) : Promise.resolve({ data: [] }),
    club.permissions.payments.view ? supabase
      .from("payments")
      .select("id, amount, created_at, clients(id, full_name)")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10) : Promise.resolve({ data: [] }),
  ])

  const result: AppNotification[] = []

  for (const sub of expiredRes.data ?? []) {
    const client = Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
    if (!client) continue
    const membership = Array.isArray(sub.memberships) ? sub.memberships[0] : sub.memberships
    result.push({
      id: `ed-${sub.id}`,
      type: "expired",
      clientId: client.id,
      clientName: client.full_name,
      title: "Абонемент истёк",
      detail: "Требуется продление",
      membershipName: membership?.name ?? null,
      eventDate: sub.expires_at,
    })
  }

  for (const sub of expiringRes.data ?? []) {
    const client = Array.isArray(sub.clients) ? sub.clients[0] : sub.clients
    if (!client) continue
    const membership = Array.isArray(sub.memberships) ? sub.memberships[0] : sub.memberships
    const days = Math.ceil((new Date(sub.expires_at).getTime() - now.getTime()) / 86_400_000)
    result.push({
      id: `exp-${sub.id}`,
      type: "expiring",
      clientId: client.id,
      clientName: client.full_name,
      title: "Абонемент скоро истечёт",
      detail: days === 0 ? "Сегодня" : `Через ${days} дн.`,
      membershipName: membership?.name ?? null,
      eventDate: sub.expires_at,
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
      title: "Платёж ожидает подтверждения",
      detail: `${Number(pay.amount).toLocaleString("ru-RU")} сум`,
      membershipName: null,
      eventDate: pay.created_at,
    })
  }

  return result
}

// ── Заявки клуба (для 2-й вкладки уведомлений) ───────────────────────
export type AppRequest = {
  id: string
  kind: "payment" | "billing"
  title: string
  status: string
  statusLabel: string
  statusColor: string
  createdAt: string
}

const PLAN_LABELS: Record<string, string> = { starter: "Старт", standard: "Стандарт", business: "Бизнес", trial: "Пробный" }

function requestStatusMeta(kind: "payment" | "billing", status: string): { statusLabel: string; statusColor: string } {
  const done = kind === "payment" ? "active" : "approved"
  if (status === done) return { statusLabel: kind === "payment" ? "Подключено" : "Одобрено", statusColor: "#16a34a" }
  if (status === "rejected") return { statusLabel: "Отклонено", statusColor: "#dc2626" }
  if (status === "cancelled") return { statusLabel: "Отменено", statusColor: "var(--gray-muted)" }
  return { statusLabel: "На рассмотрении", statusColor: "#d97706" } // new / pending
}

export async function getRequestsAction(): Promise<AppRequest[]> {
  const club = await getCurrentClub()
  if (!club) return []
  const supabase = await createClient()

  const [pcr, pbr] = await Promise.all([
    club.permissions.settings.integrations ? supabase.from("payment_connection_requests")
      .select("id, provider, status, created_at").eq("club_id", club.clubId)
      .order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    club.permissions.settings.subscription ? supabase.from("platform_billing_requests")
      .select("id, plan, months, amount, status, created_at").eq("club_id", club.clubId)
      .order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ])

  const out: AppRequest[] = []
  for (const r of pcr.data ?? []) {
    out.push({
      id: `pcr-${r.id}`, kind: "payment",
      title: `Подключение ${r.provider === "click" ? "Click" : "Payme"}`,
      status: r.status, ...requestStatusMeta("payment", r.status), createdAt: r.created_at,
    })
  }
  for (const r of pbr.data ?? []) {
    const months = Number(r.months) || 1
    out.push({
      id: `pbr-${r.id}`, kind: "billing",
      title: `Тариф «${PLAN_LABELS[r.plan] ?? r.plan}»${months > 1 ? ` · ${months} мес` : ""}`,
      status: r.status, ...requestStatusMeta("billing", r.status), createdAt: r.created_at,
    })
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Quick actions: memberships for client/payment forms ──────────────
export type QuickMembership = { id: string; name: string; price: number }

export async function getMembershipsForDrawer(): Promise<QuickMembership[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  const { data } = await supabase
    .from("memberships")
    .select("id, name, price")
    .eq("club_id", club.clubId)
    .eq("is_active", true)
    .order("name")
  return (data ?? []).map((m) => ({ id: m.id, name: m.name, price: m.price ?? 0 }))
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

export async function switchBranchAction(clubId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  // Verify the requesting user actually belongs to this club
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .eq("is_active", true)
    .maybeSingle()

  if (!staffRow) return { error: "Нет доступа к этому клубу" }

  const { cookies } = await import("next/headers")
  const store = await cookies()
  store.set("selected_club_id", clubId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" })
  // Явный выбор своего клуба ВСЕГДА выходит из режима impersonation —
  // иначе pa_impersonate (у него приоритет в getCurrentClub) продолжил бы
  // показывать данные чужого клуба поверх выбранного. Критично для изоляции.
  store.set("pa_impersonate", "", { path: "/", maxAge: 0 })
  return {}
}
