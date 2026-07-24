"use server"

import { can } from "@/lib/permissions"
import { sanitizeSearchTerm } from "@/lib/search"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"
import { createServiceClient } from "@/lib/supabase/service"
import { validateQrPass } from "@/lib/qr-pass"

export type MarkVisitResult = {
  ok?: boolean
  error?: string
  warning?: string
}

export type QrVisitResult = MarkVisitResult & { clientName?: string }

type ManualClientRecord = {
  id: string
  full_name: string
  phone: string | null
  photo_url: string | null
  subscriptions: Array<{
    id: string
    status: string
    expires_at: string | null
    visits_total: number | null
    visits_used: number | null
    memberships: { name: string } | Array<{ name: string }> | null
  }> | null
}

export async function qrCheckInAction(qrToken: string): Promise<QrVisitResult> {
  const token = qrToken.trim()
  const supabase = await createClient()
  const service = createServiceClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "visits", "checkin")) return { error: "Недостаточно прав" }

  const pass = validateQrPass(token, club.clubId)
  if (!pass) return { error: token.startsWith("fitcrm.qr.")
    ? "QR-код истёк. Попросите клиента открыть новый код"
    : "Этот QR-код не относится к FitCRM" }

  const { data: client } = await supabase.from("clients")
    .select("id, full_name")
    .eq("club_id", club.clubId)
    .eq("id", pass.clientId)
    .maybeSingle()
  if (!client) return { error: "Клиент с этим QR-кодом не найден в вашем клубе" }

  const { error: redemptionError } = await service.from("qr_pass_redemptions").insert({
    jti: pass.jti,
    club_id: club.clubId,
    client_id: client.id,
    expires_at: new Date(pass.exp * 1000).toISOString(),
  })
  if (redemptionError?.code === "23505") return { error: "Этот QR-код уже использован", clientName: client.full_name }
  if (redemptionError) return { error: "Не удалось проверить QR-код", clientName: client.full_name }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
  const [{ data: subscription }, { count: visitsToday }] = await Promise.all([
    supabase.from("subscriptions")
      .select("id, status, expires_at, visits_total, visits_used")
      .eq("club_id", club.clubId)
      .eq("client_id", client.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("visits").select("id", { count: "exact", head: true })
      .eq("club_id", club.clubId).eq("client_id", client.id)
      .gte("checked_in_at", `${today}T00:00:00+05:00`)
      .lt("checked_in_at", `${today}T23:59:59.999+05:00`),
  ])

  if (visitsToday) return { error: "Посещение этого клиента сегодня уже отмечено", clientName: client.full_name }
  if (!subscription) return { error: "Нет активного абонемента", clientName: client.full_name }
  if (subscription.visits_total !== null && subscription.visits_used >= subscription.visits_total) {
    return { error: "Лимит посещений исчерпан", clientName: client.full_name }
  }

  const { data: recorded, error } = await supabase.rpc("record_visit", {
    p_club_id: club.clubId,
    p_client_id: client.id,
    p_subscription_id: subscription.id,
    p_method: "qr",
    p_checked_in_at: null,
    p_comment: null,
    p_force: false,
  })
  if (error || recorded?.duplicate) {
    await service.from("qr_pass_redemptions").delete().eq("jti", pass.jti).eq("club_id", club.clubId)
    return { error: recorded?.duplicate ? "Посещение этого клиента сегодня уже отмечено" : "Не удалось отметить посещение", clientName: client.full_name }
  }

  revalidatePath("/visits")
  const visitsLeft = recorded?.visits_left == null ? null : Number(recorded.visits_left)
  return {
    ok: true,
    clientName: client.full_name,
    warning: visitsLeft !== null && visitsLeft <= 3 ? `Осталось ${visitsLeft} посещений` : undefined,
  }
}

export async function markVisitAction(
  clientId: string,
  subscriptionId: string | null
): Promise<MarkVisitResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "visits", "checkin")) return { error: "Недостаточно прав" }

  const { data, error } = await supabase.rpc("record_visit", {
    p_club_id: club.clubId,
    p_client_id: clientId,
    p_subscription_id: subscriptionId,
    p_method: "manual",
    p_checked_in_at: null,
    p_comment: null,
    p_force: false,
  })
  if (error) return { error: error.message }
  if (data?.duplicate) return { error: "Посещение этого клиента сегодня уже отмечено" }

  revalidatePath("/visits")
  const visitsLeft = data?.visits_left == null ? null : Number(data.visits_left)
  return { ok: true, warning: visitsLeft !== null && visitsLeft <= 3 ? `Осталось ${visitsLeft} посещений` : undefined }
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

  const clients = data as unknown as ManualClientRecord[]
  const clientIds = clients.map((c) => c.id)
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

  const visitedTodaySet = new Set((todayVisitsRes.data ?? []).map((v) => v.client_id))

  const debtMap: Record<string, number> = {}
  for (const p of debtRes.data ?? []) {
    debtMap[p.client_id] = (debtMap[p.client_id] ?? 0) + Number(p.amount)
  }

  const lastVisitMap: Record<string, string> = {}
  for (const v of lastVisitRes.data ?? []) {
    if (!lastVisitMap[v.client_id]) lastVisitMap[v.client_id] = v.checked_in_at
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  return clients.map((c) => {
    const subs: ManualClientSub[] = (c.subscriptions ?? [])
      .map((s) => {
        const vt: number | null = s.visits_total ?? null
        const vu: number = s.visits_used ?? 0
        return {
          id: s.id,
          membershipName: (Array.isArray(s.memberships) ? s.memberships[0]?.name : s.memberships?.name) ?? "Абонемент",
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

  const localTimestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(input.checkedInAt)
    ? input.checkedInAt
    : `${input.checkedInAt}+05:00`
  const checkedInAt = new Date(localTimestamp)
  if (Number.isNaN(checkedInAt.getTime())) return { error: "Некорректная дата посещения" }

  const { data: recorded, error: insertErr } = await supabase.rpc("record_visit", {
    p_club_id: club.clubId,
    p_client_id: input.clientId,
    p_subscription_id: input.subscriptionId,
    p_method: "manual",
    p_checked_in_at: checkedInAt.toISOString(),
    p_comment: input.comment || null,
    p_force: input.force,
  })

  if (insertErr) return { error: insertErr.message }
  if (recorded?.duplicate) return { error: "duplicate", duplicateAt: recorded.duplicate_at }

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
          checked_in_at: checkedInAt.toISOString(),
          visit_type:    input.visitType,
          method:        "manual",
        },
      })
    } catch { /* audit log failure is non-fatal */ }
  }

  revalidatePath("/visits")
  revalidatePath("/dashboard")
  const visitsLeft = recorded?.visits_left == null ? null : Number(recorded.visits_left)
  return { ok: true, warning: visitsLeft !== null && visitsLeft <= 3 ? `Осталось ${visitsLeft} посещений` : undefined }
}
