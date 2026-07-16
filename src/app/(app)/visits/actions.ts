"use server"

import { can } from "@/lib/permissions"
import { sanitizeSearchTerm } from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"

export type MarkVisitResult = {
  ok?: boolean
  error?: string
  warning?: string
}

export async function markVisitAction(
  clientId: string,
  subscriptionId: string | null
): Promise<MarkVisitResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "visits", "checkin")) return { error: "Недостаточно прав" }

  let warning: string | undefined

  if (subscriptionId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, visits_total, visits_used")
      .eq("id", subscriptionId)
      .single()

    if (sub?.status === "expired") {
      return { error: "Абонемент истёк — сначала продлите" }
    }
    if (sub?.visits_total !== null && sub !== null && sub.visits_used >= sub.visits_total) {
      return { error: "Исчерпан лимит посещений" }
    }
    if (sub?.visits_total !== null && sub !== null && sub.visits_total - sub.visits_used <= 3) {
      warning = `Осталось ${sub.visits_total - sub.visits_used} посещений`
    }

    await supabase
      .from("subscriptions")
      .update({ visits_used: (sub?.visits_used ?? 0) + 1 })
      .eq("id", subscriptionId)
  }

  const { error } = await supabase.from("visits").insert({
    club_id: club.clubId,
    client_id: clientId,
    subscription_id: subscriptionId ?? null,
    method: "manual",
  })

  if (error) return { error: error.message }

  revalidatePath("/visits")
  return { ok: true, warning }
}

export async function searchClientsAction(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  return searchClientsForCheckin(supabase, query, club.clubId)
}

// ── Manual visit ──────────────────────────────────────────────────

export type ManualClientSub = {
  id: string
  membershipName: string
  status: string
  expiresAt: string | null
  daysLeft: number | null
  visitsTotal: number | null
  visitsUsed: number
  visitsLeft: number | null
}

export type ManualClientResult = {
  id: string
  name: string
  phone: string | null
  photoUrl: string | null
  subscriptions: ManualClientSub[]
  debt: number
  lastVisitAt: string | null
  visitedToday: boolean
}

function daysUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

export async function searchClientsManualAction(query: string): Promise<ManualClientResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club || query.trim().length < 1) return []

  const { data } = await supabase
    .from("clients")
    .select(`
      id, full_name, phone, photo_url,
      subscriptions(id, status, expires_at, visits_total, visits_used, memberships(name))
    `)
    .eq("club_id", club.clubId)
    .or(`full_name.ilike.%${sanitizeSearchTerm(query)}%,phone.ilike.%${sanitizeSearchTerm(query)}%`)
    .limit(8)

  if (!data?.length) return []

  const clientIds = data.map((c: any) => c.id)
  const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00"
  const todayEnd   = new Date().toISOString().slice(0, 10) + "T23:59:59"

  const [todayVisitsRes, debtRes, lastVisitRes] = await Promise.all([
    supabase.from("visits").select("client_id")
      .eq("club_id", club.clubId)
      .in("client_id", clientIds)
      .gte("checked_in_at", todayStart),
    supabase.from("payments").select("client_id, amount")
      .eq("club_id", club.clubId)
      .eq("status", "pending")
      .in("client_id", clientIds),
    supabase.from("visits").select("client_id, checked_in_at")
      .eq("club_id", club.clubId)
      .in("client_id", clientIds)
      .lte("checked_in_at", todayEnd)
      .order("checked_in_at", { ascending: false })
      .limit(clientIds.length * 3),
  ])

  const visitedTodaySet = new Set((todayVisitsRes.data ?? []).map((v: any) => v.client_id))

  const debtMap: Record<string, number> = {}
  for (const p of debtRes.data ?? []) {
    debtMap[p.client_id] = (debtMap[p.client_id] ?? 0) + Number(p.amount)
  }

  const lastVisitMap: Record<string, string> = {}
  for (const v of lastVisitRes.data ?? []) {
    if (!lastVisitMap[v.client_id]) lastVisitMap[v.client_id] = v.checked_in_at
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  return data.map((c: any) => {
    const subs: ManualClientSub[] = (c.subscriptions ?? [])
      .map((s: any) => {
        const vt: number | null = s.visits_total ?? null
        const vu: number = s.visits_used ?? 0
        return {
          id: s.id,
          membershipName: s.memberships?.name ?? "Абонемент",
          status: s.status,
          expiresAt: s.expires_at ?? null,
          daysLeft: daysUntil(s.expires_at ?? null),
          visitsTotal: vt,
          visitsUsed: vu,
          visitsLeft: vt !== null ? vt - vu : null,
        }
      })
      // Показываем только реально пригодные: активные, не истёкшие по дате, с остатком посещений.
      // (В БД статус часто остаётся 'active' у просроченных — фильтруем по факту.)
      .filter((s: ManualClientSub) =>
        s.status === "active"
        && (s.expiresAt === null || s.expiresAt >= todayStr)
        && (s.visitsTotal === null || s.visitsUsed < s.visitsTotal),
      )
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone ?? null,
      photoUrl: c.photo_url ?? null,
      subscriptions: subs,
      debt: debtMap[c.id] ?? 0,
      lastVisitAt: lastVisitMap[c.id] ?? null,
      visitedToday: visitedTodaySet.has(c.id),
    }
  })
}

export type ManualVisitInput = {
  clientId: string
  subscriptionId: string | null
  checkedInAt: string       // ISO datetime YYYY-MM-DDTHH:mm:00
  visitType: string
  comment: string
  force: boolean
}

export type ManualVisitResult = {
  ok?: boolean
  error?: string
  warning?: string
  duplicateAt?: string      // existing visit time if duplicate
}

export async function manualVisitAction(input: ManualVisitInput): Promise<ManualVisitResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "visits", "manual")) return { error: "Недостаточно прав" }
  if (!club.permissions.visits.manual) return { error: "Нет прав для ручной регистрации посещений" }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", club.clubId)
    .single()

  // Verify client belongs to this club
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", input.clientId)
    .eq("club_id", club.clubId)
    .single()
  if (!clientRow) return { error: "Клиент не найден в этом клубе" }

  let warning: string | undefined

  // Subscription checks
  if (input.subscriptionId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, visits_total, visits_used, client_id")
      .eq("id", input.subscriptionId)
      .single()

    if (!sub || sub.client_id !== input.clientId) return { error: "Абонемент не принадлежит клиенту" }
    if (sub.status === "expired")  return { error: "Абонемент истёк — сначала продлите" }
    if (sub.status === "frozen")   return { error: "Абонемент заморожен — регистрация невозможна" }
    if (sub.visits_total !== null && sub.visits_used >= sub.visits_total) {
      return { error: "Лимит посещений исчерпан" }
    }
    if (sub.visits_total !== null && sub.visits_total - sub.visits_used <= 3) {
      warning = `Осталось ${sub.visits_total - sub.visits_used} посещений`
    }
  }

  // Duplicate check (same day)
  if (!input.force) {
    const datePrefix = input.checkedInAt.slice(0, 10)
    const { data: existing } = await supabase
      .from("visits")
      .select("checked_in_at")
      .eq("club_id", club.clubId)
      .eq("client_id", input.clientId)
      .gte("checked_in_at", datePrefix + "T00:00:00")
      .lte("checked_in_at", datePrefix + "T23:59:59")
      .limit(1)
      .single()

    if (existing) {
      return { error: "duplicate", duplicateAt: existing.checked_in_at }
    }
  }

  // Decrement visits_used
  if (input.subscriptionId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("visits_used")
      .eq("id", input.subscriptionId)
      .single()
    if (sub) {
      await supabase
        .from("subscriptions")
        .update({ visits_used: sub.visits_used + 1 })
        .eq("id", input.subscriptionId)
    }
  }

  // Insert visit
  const { error: insertErr } = await supabase.from("visits").insert({
    club_id:         club.clubId,
    client_id:       input.clientId,
    subscription_id: input.subscriptionId ?? null,
    checked_in_at:   input.checkedInAt,
    method:          "manual",
    comment:         input.comment || null,
  })

  if (insertErr) return { error: insertErr.message }

  // Audit log
  if (user && staffRow) {
    try {
      await supabase.from("audit_logs").insert({
        club_id:    club.clubId,
        user_id:    user.id,
        action:     "manual_visit",
        table_name: "visits",
        record_id:  input.clientId,
        new_data: {
          client_name:   clientRow.full_name,
          checked_in_at: input.checkedInAt,
          visit_type:    input.visitType,
          method:        "manual",
        },
      })
    } catch { /* audit log failure is non-fatal */ }
  }

  revalidatePath("/visits")
  revalidatePath("/dashboard")
  return { ok: true, warning }
}
