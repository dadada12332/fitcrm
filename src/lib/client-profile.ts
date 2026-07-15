import type { SupabaseClient } from "@supabase/supabase-js"
import type { ClientStatus } from "@/lib/clients"

export type PaymentProvider = "click" | "payme" | "uzum" | "cash"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"
export type VisitMethod = "manual" | "qr" | "telegram"

export type ProfilePayment = {
  id: string
  paidAt: string | null
  amount: number
  provider: PaymentProvider
  status: PaymentStatus
}

export type ProfileVisit = {
  id: string
  checkedInAt: string
  method: VisitMethod
}

export type CurrentSubscription = {
  name: string
  startsAt: string | null
  expiresAt: string | null
  daysLeft: number | null
  visitsUsed: number
  visitsTotal: number | null
  freezeDaysAllowed: number
  freezeDaysUsed: number
  usedPct: number
}

export type ClientProfile = {
  id: string
  name: string
  phone: string | null
  telegram: string | null
  email: string | null
  birthDate: string | null
  gender: string | null
  source: string | null
  trainer: string | null
  balance: number
  debt: number
  notes: string | null
  tags: string[]
  photoUrl: string | null
  createdAt: string
  status: ClientStatus
  subscription: CurrentSubscription | null
  payments: ProfilePayment[]
  visits: ProfileVisit[]
}

type SubRow = {
  status: string
  starts_at: string | null
  expires_at: string | null
  visits_total: number | null
  visits_used: number | null
  freeze_days_used: number | null
  memberships:
    | { name: string; visits_limit: number | null; freeze_days_allowed: number | null }
    | { name: string; visits_limit: number | null; freeze_days_allowed: number | null }[]
    | null
}

function pickSubscription(subs: SubRow[]): SubRow | null {
  if (!subs?.length) return null
  const active = subs.find((s) => s.status === "active")
  if (active) return active
  const frozen = subs.find((s) => s.status === "frozen")
  if (frozen) return frozen
  return [...subs].sort((a, b) => (b.expires_at ?? "").localeCompare(a.expires_at ?? ""))[0]
}

function membership(m: SubRow["memberships"]) {
  if (!m) return null
  return Array.isArray(m) ? m[0] ?? null : m
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

// ── Маппинги бейджей для UI ──
export const providerMeta: Record<PaymentProvider, { label: string; bg: string; color: string }> = {
  cash: { label: "Наличные", bg: "#f1f5f9", color: "#475569" },
  click: { label: "Click", bg: "#0f172a", color: "#ffffff" },
  payme: { label: "Payme", bg: "#dbeafe", color: "#2563eb" },
  uzum: { label: "Uzum Bank", bg: "#ede9fe", color: "#7c3aed" },
}

export const paymentStatusMeta: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
  paid: { label: "Успешно", bg: "#dcfce7", color: "#16a34a" },
  failed: { label: "Отменён", bg: "#fee2e2", color: "#dc2626" },
  refunded: { label: "Возврат", bg: "#fef3c7", color: "#d97706" },
  pending: { label: "В ожидании", bg: "#f1f5f9", color: "#64748b" },
}

export const visitMethodMeta: Record<VisitMethod, { label: string; bg: string; color: string }> = {
  manual: { label: "Вручную", bg: "#f1f5f9", color: "#475569" },
  qr: { label: "QR-код", bg: "#dbeafe", color: "#2563eb" },
  telegram: { label: "Telegram", bg: "#e0f2fe", color: "#0284c7" },
}

export async function getClientProfile(
  supabase: SupabaseClient,
  id: string,
  clubId: string,
): Promise<ClientProfile | null> {
  // Try full select (incl. balance/debt/trainer); fall back if columns not migrated
  const full = await supabase
    .from("clients")
    .select("id, full_name, phone, telegram_id, photo_url, tags, notes, created_at, email, birth_date, gender, source, balance, debt, trainer_name")
    .eq("id", id)
    .eq("club_id", clubId)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = full.data
  if (!client) {
    const fb = await supabase
      .from("clients")
      .select("id, full_name, phone, telegram_id, photo_url, tags, notes, created_at, email, birth_date, gender, source")
      .eq("id", id)
      .eq("club_id", clubId)
      .maybeSingle()
    client = fb.data
  }

  if (!client) return null

  const [subsRes, paymentsRes, visitsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, starts_at, expires_at, visits_total, visits_used, freeze_days_used, memberships(name, visits_limit, freeze_days_allowed)")
      .eq("client_id", id),
    supabase
      .from("payments")
      .select("id, paid_at, amount, provider, status, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("visits")
      .select("id, checked_in_at, method")
      .eq("client_id", id)
      .order("checked_in_at", { ascending: false }),
  ])

  const subs = (subsRes.data ?? []) as SubRow[]
  const sub = pickSubscription(subs)
  const status: ClientStatus = (sub?.status as ClientStatus) ?? "none"

  let subscription: CurrentSubscription | null = null
  if (sub) {
    const m = membership(sub.memberships)
    const visitsTotal = sub.visits_total ?? m?.visits_limit ?? null
    const visitsUsed = sub.visits_used ?? 0
    const freezeDaysAllowed = m?.freeze_days_allowed ?? 0
    const usedPct = visitsTotal && visitsTotal > 0
      ? Math.min(100, Math.round((visitsUsed / visitsTotal) * 100))
      : 0
    subscription = {
      name: m?.name ?? "Абонемент",
      startsAt: sub.starts_at,
      expiresAt: sub.expires_at,
      daysLeft: status === "active" || status === "frozen" ? daysUntil(sub.expires_at) : null,
      visitsUsed,
      visitsTotal,
      freezeDaysAllowed,
      freezeDaysUsed: sub.freeze_days_used ?? 0,
      usedPct,
    }
  }

  const payments: ProfilePayment[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id as string,
    paidAt: (p.paid_at as string | null) ?? (p.created_at as string | null),
    amount: Number(p.amount ?? 0),
    provider: (p.provider as PaymentProvider) ?? "cash",
    status: (p.status as PaymentStatus) ?? "pending",
  }))

  const visits: ProfileVisit[] = (visitsRes.data ?? []).map((v) => ({
    id: v.id as string,
    checkedInAt: v.checked_in_at as string,
    method: (v.method as VisitMethod) ?? "manual",
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any
  return {
    id: c.id as string,
    name: c.full_name as string,
    phone: (c.phone as string | null) ?? null,
    telegram: c.telegram_id ? `@${c.telegram_id}` : null,
    email: (c.email as string | null) ?? null,
    birthDate: (c.birth_date as string | null) ?? null,
    gender: (c.gender as string | null) ?? null,
    source: (c.source as string | null) ?? null,
    trainer: (c.trainer_name as string | null) ?? null,
    balance: c.balance != null ? Number(c.balance) : 0,
    debt: c.debt != null ? Number(c.debt) : 0,
    notes: (c.notes as string | null) ?? null,
    tags: (c.tags as string[] | null) ?? [],
    photoUrl: (c.photo_url as string | null) ?? null,
    createdAt: c.created_at as string,
    status,
    subscription,
    payments,
    visits,
  }
}
