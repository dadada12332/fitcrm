import { sanitizeSearchTerm } from "@/lib/search"
import { cache } from "react"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlansMap } from "@/lib/plans"

/**
 * Базовый префикс ссылок Platform.
 * На admin-хосте URL чистые ("/clubs"), локально — под /platform ("/platform/clubs").
 */
export async function platformBase(): Promise<string> {
  const h = (await headers()).get("host") ?? ""
  return h.startsWith("admin.") ? "" : "/platform"
}

/**
 * Platform Admin data layer (admin.fitcrm.uz).
 *
 * ВАЖНО: все запросы идут через service-role клиент (bypass RLS), т.к. Platform
 * оперирует данными ВСЕХ клубов сразу. Доступ защищён проверкой platform_role.
 */

// ── Тарифы SaaS (для MRR / ARR). Цены в USD/мес. ──
export const PLAN_PRICES: Record<string, number> = {
  trial: 0,
  starter: 29,
  standard: 59,
  business: 99,
}

export const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  standard: "Standard",
  business: "Business",
}

// Супер-админ по email — резервный доступ, если колонка platform_role ещё не создана.
const SUPER_ADMIN_EMAILS = ["opadasebe@gmail.com"]

export type PlatformRole = "platform_admin" | "super_admin"

export type PlatformAuth = {
  userId: string
  email: string
  fullName: string | null
  role: PlatformRole
} | null

/** Проверка: текущий пользователь — админ платформы. Кешируется на запрос. */
export const getPlatformAuth = cache(async (): Promise<PlatformAuth> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Пробуем прочитать platform_role. Если колонки нет (миграция не применена) —
  // падаем на резервный список email.
  let role: PlatformRole | null = null
  let fullName: string | null = null
  try {
    const { data, error } = await service
      .from("users")
      .select("platform_role, full_name, email")
      .eq("id", user.id)
      .maybeSingle()
    if (error) throw error
    fullName = data?.full_name ?? null
    if (data?.platform_role === "platform_admin" || data?.platform_role === "super_admin") {
      role = data.platform_role
    }
  } catch {
    // колонка platform_role отсутствует — резервная проверка по email
  }

  if (!role && user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    role = "super_admin"
  }

  if (!role) return null
  return { userId: user.id, email: user.email ?? "", fullName, role }
})

// ── Health Score ──────────────────────────────────────────────
export type HealthTier = { score: number; label: string; color: string }

export function healthTier(score: number): HealthTier {
  if (score >= 80) return { score, label: "Отлично", color: "#22c55e" }
  if (score >= 60) return { score, label: "Хорошо", color: "#84cc16" }
  if (score >= 40) return { score, label: "Средне", color: "#f59e0b" }
  if (score >= 20) return { score, label: "Риск", color: "#f97316" }
  return { score, label: "Критично", color: "#ef4444" }
}

/**
 * Рассчитать Health Score клуба (0..100) из доступных метрик.
 * Учитывает: активность (посещения), активные клиенты, свежесть оплат,
 * не истёк ли план, наличие сотрудников.
 */
export function computeHealthScore(m: {
  visits30: number
  activeClients: number
  totalClients: number
  daysSinceLastPayment: number | null
  planExpired: boolean
  staffCount: number
}): number {
  let score = 0
  // Посещаемость (0..30): 100+ визитов за 30 дней = максимум
  score += Math.min(30, Math.round((m.visits30 / 100) * 30))
  // Активные клиенты (0..25)
  score += Math.min(25, Math.round((m.activeClients / 50) * 25))
  // Свежесть оплаты (0..25)
  if (m.daysSinceLastPayment === null) score += 0
  else if (m.daysSinceLastPayment <= 7) score += 25
  else if (m.daysSinceLastPayment <= 30) score += 18
  else if (m.daysSinceLastPayment <= 60) score += 8
  else score += 0
  // План активен (0..12)
  score += m.planExpired ? 0 : 12
  // Есть команда (0..8)
  score += Math.min(8, m.staffCount * 4)
  return Math.max(0, Math.min(100, score))
}

// ── Обзор платформы (Command Center) ──────────────────────────
export type PlatformOverview = {
  totalClubs: number
  activeClubs: number
  trialClubs: number
  expiredClubs: number
  suspendedClubs: number
  newClubs30: number
  totalUsers: number
  totalClients: number
  visitsToday: number
  visits30: number
  paymentsToday: number
  paymentsToday30: number
  revenue30: number
  mrr: number
  arr: number
  attentionClubs: number
  planBreakdown: { plan: string; count: number }[]
}

function daysDiff(from: string | null): number | null {
  if (!from) return null
  return Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000)
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const service = createServiceClient()
  const now = Date.now()
  const iso30 = new Date(now - 30 * 86_400_000).toISOString()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const isoToday = todayStart.toISOString()

  const [
    clubsRes,
    usersRes,
    clientsRes,
    visitsTodayRes,
    visits30Res,
    paymentsTodayRes,
    payments30Res,
    plansMap,
  ] = await Promise.all([
    service.from("clubs").select("id, plan, status, trial_expires_at, plan_expires_at, created_at, plan_price_locked"),
    service.from("users").select("id", { count: "exact", head: true }),
    service.from("clients").select("id", { count: "exact", head: true }),
    service.from("visits").select("id", { count: "exact", head: true }).gte("checked_in_at", isoToday),
    service.from("visits").select("id", { count: "exact", head: true }).gte("checked_in_at", iso30),
    service.from("payments").select("amount, status, created_at").gte("created_at", isoToday),
    service.from("payments").select("amount, status, created_at").gte("created_at", iso30),
    getPlansMap(),
  ])

  const clubs = clubsRes.data ?? []
  let activeClubs = 0, trialClubs = 0, expiredClubs = 0, suspendedClubs = 0, newClubs30 = 0
  let mrr = 0
  const planCounts: Record<string, number> = {}

  for (const c of clubs) {
    const status = (c as { status?: string }).status ?? "active"
    const plan = c.plan ?? "trial"
    planCounts[plan] = (planCounts[plan] ?? 0) + 1

    if (status === "suspended") suspendedClubs++
    if (c.created_at && new Date(c.created_at).getTime() >= now - 30 * 86_400_000) newClubs30++

    const planExp = c.plan_expires_at ? new Date(c.plan_expires_at).getTime() : null
    const trialExp = c.trial_expires_at ? new Date(c.trial_expires_at).getTime() : null

    if (plan === "trial") {
      trialClubs++
      if (trialExp && trialExp < now) expiredClubs++
    } else if (status === "active") {
      if (planExp && planExp < now) {
        expiredClubs++
      } else {
        activeClubs++
        // Grandfather pricing: если у клуба зафиксирована цена — берём её, иначе актуальную цену тарифа.
        const locked = (c as { plan_price_locked?: number | null }).plan_price_locked
        mrr += (locked != null ? Number(locked) : (plansMap[plan]?.price ?? 0))
      }
    }
  }

  const paymentsToday = (paymentsTodayRes.data ?? []).filter((p) => p.status === "paid")
  const payments30 = (payments30Res.data ?? []).filter((p) => p.status === "paid")
  const revenue30 = payments30.reduce((s, p) => s + Number(p.amount ?? 0), 0)

  // «Требует внимания»: истёкшие + приостановленные
  const attentionClubs = expiredClubs + suspendedClubs

  return {
    totalClubs: clubs.length,
    activeClubs,
    trialClubs,
    expiredClubs,
    suspendedClubs,
    newClubs30,
    totalUsers: usersRes.count ?? 0,
    totalClients: clientsRes.count ?? 0,
    visitsToday: visitsTodayRes.count ?? 0,
    visits30: visits30Res.count ?? 0,
    paymentsToday: paymentsToday.length,
    paymentsToday30: payments30.length,
    revenue30,
    mrr,
    arr: mrr * 12,
    attentionClubs,
    planBreakdown: Object.entries(planCounts)
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// ── Живая лента событий (Command Center) ──────────────────────
export type LiveEvent = {
  id: string
  type: "new_club" | "payment" | "new_client" | "trial_expiring"
  title: string
  subtitle: string
  at: string
}

export async function getLiveEvents(limit = 20): Promise<LiveEvent[]> {
  const service = createServiceClient()
  const [clubsRes, paymentsRes, clientsRes] = await Promise.all([
    service.from("clubs").select("id, name, created_at").order("created_at", { ascending: false }).limit(8),
    service.from("payments").select("id, amount, created_at, clubs(name)").eq("status", "paid").order("created_at", { ascending: false }).limit(10),
    service.from("clients").select("id, full_name, created_at, clubs(name)").order("created_at", { ascending: false }).limit(8),
  ])

  const events: LiveEvent[] = []

  for (const c of clubsRes.data ?? []) {
    events.push({
      id: `club-${c.id}`,
      type: "new_club",
      title: "Новый клуб",
      subtitle: c.name,
      at: c.created_at,
    })
  }
  for (const p of (paymentsRes.data ?? []) as unknown as { id: string; amount: number; created_at: string; clubs: { name: string } | null }[]) {
    events.push({
      id: `pay-${p.id}`,
      type: "payment",
      title: `Оплата ${Number(p.amount).toLocaleString("ru-RU")} сум`,
      subtitle: p.clubs?.name ?? "Клуб",
      at: p.created_at,
    })
  }
  for (const c of (clientsRes.data ?? []) as unknown as { id: string; full_name: string; created_at: string; clubs: { name: string } | null }[]) {
    events.push({
      id: `cl-${c.id}`,
      type: "new_client",
      title: "Новый клиент",
      subtitle: `${c.full_name} · ${c.clubs?.name ?? ""}`,
      at: c.created_at,
    })
  }

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
}

// ── Клубы, требующие внимания (Command Center) ────────────────
export type AttentionClub = { id: string; name: string; reason: string; severity: "warn" | "alert" }

export async function getAttentionClubs(limit = 8): Promise<AttentionClub[]> {
  const service = createServiceClient()
  const now = Date.now()
  const { data } = await service
    .from("clubs")
    .select("id, name, plan, status, trial_expires_at, plan_expires_at")
    .order("created_at", { ascending: false })
    .limit(400)

  const out: AttentionClub[] = []
  for (const c of data ?? []) {
    const status = (c as { status?: string }).status ?? "active"
    if (status === "suspended") {
      out.push({ id: c.id, name: c.name, reason: "Клуб приостановлен", severity: "alert" })
      continue
    }
    if (c.plan === "trial") {
      const exp = c.trial_expires_at ? new Date(c.trial_expires_at).getTime() : null
      if (exp !== null) {
        const days = Math.ceil((exp - now) / 86_400_000)
        if (days < 0) out.push({ id: c.id, name: c.name, reason: "Trial истёк", severity: "alert" })
        else if (days <= 3) out.push({ id: c.id, name: c.name, reason: `Trial истекает через ${days} дн.`, severity: "warn" })
      }
    } else {
      const exp = c.plan_expires_at ? new Date(c.plan_expires_at).getTime() : null
      if (exp !== null && exp < now) out.push({ id: c.id, name: c.name, reason: "Подписка просрочена", severity: "alert" })
    }
  }
  return out
    .sort((a, b) => (a.severity === "alert" ? -1 : 1) - (b.severity === "alert" ? -1 : 1))
    .slice(0, limit)
}

// ── Список клубов (серверный поиск/пагинация/сортировка) ──────
export type ClubRow = {
  id: string
  name: string
  city: string | null
  ownerEmail: string | null
  ownerName: string | null
  plan: string
  status: string
  createdAt: string
  clientsCount: number
  staffCount: number
  lastActivity: string | null
  lastPayment: string | null
  trialExpiresAt: string | null
  planExpiresAt: string | null
  health: number
}

export type ClubsListResult = {
  rows: ClubRow[]
  total: number
  page: number
  pageSize: number
}

export async function getClubsList(opts: {
  search?: string
  page?: number
  pageSize?: number
  status?: string
  plan?: string
}): Promise<ClubsListResult> {
  const service = createServiceClient()
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = opts.pageSize ?? 25
  const from = page * pageSize
  const to = from + pageSize - 1

  let q = service
    .from("clubs")
    .select("id, name, city, owner_id, plan, status, trial_expires_at, plan_expires_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })

  if (opts.search && opts.search.trim()) q = q.ilike("name", `%${opts.search.trim()}%`)
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status)
  if (opts.plan && opts.plan !== "all") q = q.eq("plan", opts.plan)

  const { data, count } = await q.range(from, to)
  const clubs = data ?? []
  const ids = clubs.map((c) => c.id)
  const ownerIds = clubs.map((c) => c.owner_id).filter(Boolean) as string[]

  // Параллельно собираем метрики по видимой странице клубов.
  const now = Date.now()

  const [ownersRes, metricsRes] = await Promise.all([
    ownerIds.length ? service.from("users").select("id, email, full_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
    // Серверные агрегаты (RPC): count/max по индексам club_id — без лимита PostgREST 1000 строк.
    ids.length ? service.rpc("platform_clubs_metrics", { p_ids: ids }) : Promise.resolve({ data: [] }),
  ])

  const ownerMap = new Map<string, { email: string | null; full_name: string | null }>()
  for (const o of (ownersRes.data ?? []) as unknown as { id: string; email: string | null; full_name: string | null }[]) {
    ownerMap.set(o.id, { email: o.email, full_name: o.full_name })
  }
  const clientsCount = new Map<string, number>()
  const staffCount = new Map<string, number>()
  const visits30 = new Map<string, number>()
  const lastActivity = new Map<string, string>()
  const lastPayment = new Map<string, string>()
  for (const m of (metricsRes.data ?? []) as unknown as {
    club_id: string; clients_count: number; staff_count: number; visits_30: number
    last_activity: string | null; last_payment: string | null
  }[]) {
    clientsCount.set(m.club_id, Number(m.clients_count) || 0)
    staffCount.set(m.club_id, Number(m.staff_count) || 0)
    visits30.set(m.club_id, Number(m.visits_30) || 0)
    if (m.last_activity) lastActivity.set(m.club_id, m.last_activity)
    if (m.last_payment) lastPayment.set(m.club_id, m.last_payment)
  }

  const rows: ClubRow[] = clubs.map((c) => {
    const owner = c.owner_id ? ownerMap.get(c.owner_id) : null
    const planExpired = c.plan === "trial"
      ? !!(c.trial_expires_at && new Date(c.trial_expires_at).getTime() < now)
      : !!(c.plan_expires_at && new Date(c.plan_expires_at).getTime() < now)
    const lp = lastPayment.get(c.id) ?? null
    const health = computeHealthScore({
      visits30: visits30.get(c.id) ?? 0,
      activeClients: clientsCount.get(c.id) ?? 0,
      totalClients: clientsCount.get(c.id) ?? 0,
      daysSinceLastPayment: daysDiff(lp),
      planExpired,
      staffCount: staffCount.get(c.id) ?? 0,
    })
    return {
      id: c.id,
      name: c.name,
      city: c.city,
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.full_name ?? null,
      plan: c.plan ?? "trial",
      status: (c as { status?: string }).status ?? "active",
      createdAt: c.created_at,
      clientsCount: clientsCount.get(c.id) ?? 0,
      staffCount: staffCount.get(c.id) ?? 0,
      lastActivity: lastActivity.get(c.id) ?? null,
      lastPayment: lp,
      trialExpiresAt: c.trial_expires_at,
      planExpiresAt: c.plan_expires_at,
      health,
    }
  })

  return { rows, total: count ?? rows.length, page, pageSize }
}

// ── Карточка клуба ────────────────────────────────────────────
export type ClubDetail = ClubRow & {
  visits30: number
  revenue30: number
  paymentsCount: number
  activeSubscriptions: number
  planPriceLocked: number | null
  recentPayments: { id: string; amount: number; provider: string; createdAt: string; clientName: string | null }[]
  staff: { id: string; name: string | null; email: string | null; role: string }[]
}

export async function getClubDetail(clubId: string): Promise<ClubDetail | null> {
  const service = createServiceClient()
  const { data: club } = await service
    .from("clubs")
    .select("id, name, city, owner_id, plan, status, trial_expires_at, plan_expires_at, created_at, admin_notes, plan_price_locked")
    .eq("id", clubId)
    .maybeSingle()
  if (!club) return null

  const now = Date.now()
  const iso30 = new Date(now - 30 * 86_400_000).toISOString()

  const [ownerRes, clientsRes, staffRes, visitsRes, payAllRes, payRecentRes, subsRes] = await Promise.all([
    club.owner_id ? service.from("users").select("id, email, full_name").eq("id", club.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    service.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    service.from("staff").select("id, role, is_active, users(full_name, email)").eq("club_id", clubId).eq("is_active", true),
    service.from("visits").select("id, checked_in_at").eq("club_id", clubId).gte("checked_in_at", iso30),
    service.from("payments").select("amount, status, created_at").eq("club_id", clubId).eq("status", "paid").gte("created_at", iso30),
    service.from("payments").select("id, amount, provider, created_at, clients(full_name)").eq("club_id", clubId).eq("status", "paid").order("created_at", { ascending: false }).limit(8),
    service.from("subscriptions").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "active"),
  ])

  const owner = ownerRes.data as { id: string; email: string | null; full_name: string | null } | null
  const visits = (visitsRes.data ?? []) as unknown as { checked_in_at: string }[]
  const lastActivity = visits.length ? visits.map((v) => v.checked_in_at).sort().reverse()[0] : null
  const pay30 = (payAllRes.data ?? []) as unknown as { amount: number; created_at: string }[]
  const revenue30 = pay30.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const lastPayment = pay30.length ? pay30.map((p) => p.created_at).sort().reverse()[0] : null

  const planExpired = club.plan === "trial"
    ? !!(club.trial_expires_at && new Date(club.trial_expires_at).getTime() < now)
    : !!(club.plan_expires_at && new Date(club.plan_expires_at).getTime() < now)

  const clientsCount = clientsRes.count ?? 0
  const staffList = ((staffRes.data ?? []) as unknown as { id: string; role: string; users: { full_name: string | null; email: string | null } | null }[])
    .map((s) => ({ id: s.id, name: s.users?.full_name ?? null, email: s.users?.email ?? null, role: s.role }))

  const health = computeHealthScore({
    visits30: visits.length,
    activeClients: clientsCount,
    totalClients: clientsCount,
    daysSinceLastPayment: daysDiff(lastPayment),
    planExpired,
    staffCount: staffList.length,
  })

  return {
    id: club.id,
    name: club.name,
    city: club.city,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.full_name ?? null,
    plan: club.plan ?? "trial",
    status: (club as { status?: string }).status ?? "active",
    createdAt: club.created_at,
    clientsCount,
    staffCount: staffList.length,
    lastActivity,
    lastPayment,
    trialExpiresAt: club.trial_expires_at,
    planExpiresAt: club.plan_expires_at,
    health,
    visits30: visits.length,
    revenue30,
    paymentsCount: pay30.length,
    activeSubscriptions: subsRes.count ?? 0,
    planPriceLocked: (club as { plan_price_locked?: number | null }).plan_price_locked ?? null,
    recentPayments: ((payRecentRes.data ?? []) as unknown as { id: string; amount: number; provider: string; created_at: string; clients: { full_name: string | null } | null }[])
      .map((p) => ({ id: p.id, amount: Number(p.amount), provider: p.provider, createdAt: p.created_at, clientName: p.clients?.full_name ?? null })),
    staff: staffList,
  }
}

// ── Пользователи платформы ────────────────────────────────────
export type PlatformUserRow = {
  id: string
  email: string | null
  fullName: string | null
  platformRole: string | null
  createdAt: string
  clubs: { name: string; role: string }[]
}

export async function getUsersList(opts: { search?: string; page?: number; pageSize?: number }): Promise<{ rows: PlatformUserRow[]; total: number; page: number; pageSize: number }> {
  const service = createServiceClient()
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = opts.pageSize ?? 30
  const from = page * pageSize
  const to = from + pageSize - 1

  let q = service.from("users").select("id, email, full_name, platform_role, created_at", { count: "exact" }).order("created_at", { ascending: false })
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim()
    q = q.or(`email.ilike.%${sanitizeSearchTerm(s)}%,full_name.ilike.%${sanitizeSearchTerm(s)}%`)
  }
  const { data, count } = await q.range(from, to)
  const users = data ?? []
  const ids = users.map((u) => u.id)

  const membership = new Map<string, { name: string; role: string }[]>()
  if (ids.length) {
    const { data: staff } = await service.from("staff").select("user_id, role, clubs(name)").in("user_id", ids).eq("is_active", true)
    for (const s of (staff ?? []) as unknown as { user_id: string; role: string; clubs: { name: string } | null }[]) {
      const arr = membership.get(s.user_id) ?? []
      arr.push({ name: s.clubs?.name ?? "—", role: s.role })
      membership.set(s.user_id, arr)
    }
  }

  return {
    rows: users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      platformRole: (u as { platform_role?: string | null }).platform_role ?? null,
      createdAt: u.created_at,
      clubs: membership.get(u.id) ?? [],
    })),
    total: count ?? users.length,
    page, pageSize,
  }
}

// ── Платежи платформы (кросс-клубные) ─────────────────────────
export type PlatformPaymentRow = {
  id: string
  amount: number
  provider: string
  status: string
  createdAt: string
  clubName: string | null
  clientName: string | null
}

export async function getPlatformPayments(opts: { page?: number; pageSize?: number; provider?: string }): Promise<{ rows: PlatformPaymentRow[]; total: number; page: number; pageSize: number; sum: number }> {
  const service = createServiceClient()
  const page = Math.max(0, opts.page ?? 0)
  const pageSize = opts.pageSize ?? 30
  const from = page * pageSize
  const to = from + pageSize - 1

  let q = service.from("payments").select("id, amount, provider, status, created_at, clubs(name), clients(full_name)", { count: "exact" }).order("created_at", { ascending: false })
  if (opts.provider && opts.provider !== "all") q = q.eq("provider", opts.provider)
  const { data, count } = await q.range(from, to)

  // Сумма оплаченных за 30 дней (для шапки).
  const iso30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: sumData } = await service.from("payments").select("amount").eq("status", "paid").gte("created_at", iso30)
  const sum = (sumData ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

  return {
    rows: ((data ?? []) as unknown as { id: string; amount: number; provider: string; status: string; created_at: string; clubs: { name: string } | null; clients: { full_name: string } | null }[])
      .map((p) => ({ id: p.id, amount: Number(p.amount), provider: p.provider, status: p.status, createdAt: p.created_at, clubName: p.clubs?.name ?? null, clientName: p.clients?.full_name ?? null })),
    total: count ?? 0, page, pageSize, sum,
  }
}

// ── Логи действий администраторов ─────────────────────────────
export type PlatformLogRow = {
  id: string
  adminEmail: string | null
  action: string
  clubId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export async function getPlatformLogs(limit = 100): Promise<PlatformLogRow[]> {
  const service = createServiceClient()
  try {
    const { data } = await service.from("platform_admin_logs").select("id, admin_email, action, club_id, meta, created_at").order("created_at", { ascending: false }).limit(limit)
    return ((data ?? []) as unknown as { id: string; admin_email: string | null; action: string; club_id: string | null; meta: Record<string, unknown>; created_at: string }[])
      .map((l) => ({ id: l.id, adminEmail: l.admin_email, action: l.action, clubId: l.club_id, meta: l.meta ?? {}, createdAt: l.created_at }))
  } catch {
    return []
  }
}

// ── Заявки на подписку ────────────────────────────────────────
export type BillingRequest = {
  id: string
  clubId: string
  clubName: string
  plan: string
  months: number
  amount: number | null
  status: string
  requestedEmail: string | null
  createdAt: string
  resolvedAt: string | null
}

export async function getBillingRequests(): Promise<{ pending: BillingRequest[]; recent: BillingRequest[] }> {
  const service = createServiceClient()
  try {
    const { data } = await service
      .from("platform_billing_requests")
      .select("id, club_id, plan, months, amount, status, requested_email, created_at, resolved_at, clubs(name)")
      .order("created_at", { ascending: false })
      .limit(100)
    const rows = ((data ?? []) as unknown as {
      id: string; club_id: string; plan: string; months: number; amount: number | null;
      status: string; requested_email: string | null; created_at: string; resolved_at: string | null;
      clubs: { name: string } | null
    }[]).map((r) => ({
      id: r.id, clubId: r.club_id, clubName: r.clubs?.name ?? "—", plan: r.plan, months: r.months,
      amount: r.amount, status: r.status, requestedEmail: r.requested_email, createdAt: r.created_at, resolvedAt: r.resolved_at,
    }))
    return {
      pending: rows.filter((r) => r.status === "pending"),
      recent: rows.filter((r) => r.status !== "pending").slice(0, 30),
    }
  } catch {
    return { pending: [], recent: [] }
  }
}

// ── Аудит действий администратора ─────────────────────────────
export async function logPlatformAction(input: {
  action: string
  clubId?: string | null
  targetUser?: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  const auth = await getPlatformAuth()
  if (!auth) return
  const service = createServiceClient()
  try {
    await service.from("platform_admin_logs").insert({
      admin_id: auth.userId,
      admin_email: auth.email,
      action: input.action,
      club_id: input.clubId ?? null,
      target_user: input.targetUser ?? null,
      meta: input.meta ?? {},
    })
  } catch {
    // таблица ещё не создана — молча пропускаем
  }
}
