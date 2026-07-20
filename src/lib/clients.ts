import type { SupabaseClient } from "@supabase/supabase-js"

export type ClientStatus = "active" | "expired" | "frozen" | "none"

export type ClientRow = {
  id: string
  name: string
  phone: string | null
  birthDate: string | null
  gender: string | null
  source: string | null
  membership: string | null
  expiresAt: string | null
  daysLeft: number | null
  visitsLeft: number | null
  lastVisit: string | null
  debt: number
  status: ClientStatus
}

export type ClientsStats = {
  total: number
  active: number
  expiring: number
  debt: number
}

export type ClientsData = { rows: ClientRow[]; stats: ClientsStats }

type SubRow = {
  status: string
  expires_at: string | null
  visits_total: number | null
  visits_used: number | null
  memberships: { name: string } | { name: string }[] | null
}

function pickSubscription(subs: SubRow[]): SubRow | null {
  if (!subs?.length) return null
  const active = subs.find((s) => s.status === "active")
  if (active) return active
  const frozen = subs.find((s) => s.status === "frozen")
  if (frozen) return frozen
  return [...subs].sort((a, b) => (b.expires_at ?? "").localeCompare(a.expires_at ?? ""))[0]
}

function membershipName(m: SubRow["memberships"]): string | null {
  if (!m) return null
  const obj = Array.isArray(m) ? m[0] : m
  return obj?.name ?? null
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export async function getClientsData(supabase: SupabaseClient, clubId: string): Promise<ClientsData> {
  // Точный total отдельным count — не обрезается лимитом PostgREST (max-rows=1000).
  const { count: totalCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)

  // PostgREST по умолчанию отдаёт максимум 1000 строк за запрос независимо от .limit(),
  // из-за чего клиенты сверх 1000 были невидимы, а счётчик показывал 1000.
  // Тянем всех клиентов страницами по 1000.
  const SEL_FIN = "id, full_name, phone, gender, birth_date, source, balance, debt, created_at, subscriptions(status, expires_at, visits_total, visits_used, memberships(name))"
  const SEL_NOFIN = "id, full_name, phone, gender, birth_date, source, created_at, subscriptions(status, expires_at, visits_total, visits_used, memberships(name))"
  async function fetchAll(select: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc: any[] = []
    const PAGE = 1000
    for (let from = 0; from < 50 * PAGE; from += PAGE) {
      const { data, error } = await supabase
        .from("clients")
        .select(select)
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) return { data: null, error }
      if (data) acc.push(...data)
      if (!data || data.length < PAGE) break
    }
    return { data: acc, error: null }
  }

  const primary = await fetchAll(SEL_FIN)
  let rawData: unknown[] | null = primary.data
  if (primary.error || !rawData) {
    // Fallback без balance/debt (если колонки ещё не мигрированы).
    rawData = (await fetchAll(SEL_NOFIN)).data
  }

  // Last-visit query — optional, degrades gracefully on error
  const lastVisitMap = new Map<string, string>()
  const { data: visitData } = await supabase
    .from("visits")
    .select("client_id, checked_in_at")
    .eq("club_id", clubId)
    .order("checked_in_at", { ascending: false })
    .limit(5000)
  for (const v of (visitData ?? []) as { client_id: string; checked_in_at: string }[]) {
    if (!lastVisitMap.has(v.client_id)) lastVisitMap.set(v.client_id, v.checked_in_at)
  }

  const clients = (rawData ?? []) as {
    id: string
    full_name: string
    phone: string | null
    gender: string | null
    birth_date: string | null
    source: string | null
    balance?: number | null
    debt?: number | null
    subscriptions: SubRow[] | null
  }[]

  const rows: ClientRow[] = clients.map((c) => {
    const sub = pickSubscription(c.subscriptions ?? [])
    const status: ClientStatus = (sub?.status as ClientStatus) ?? "none"
    const expiresAt = sub?.expires_at ?? null
    const visitsLeft =
      sub?.visits_total != null && sub?.visits_used != null
        ? Math.max(0, sub.visits_total - sub.visits_used)
        : null
    // Debt = explicit debt column, or negative balance as a fallback signal
    const debt = c.debt != null ? Number(c.debt) : (c.balance != null && c.balance < 0 ? Math.abs(c.balance) : 0)
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone,
      birthDate: c.birth_date ?? null,
      gender: c.gender ?? null,
      source: c.source ?? null,
      membership: membershipName(sub?.memberships ?? null),
      expiresAt,
      daysLeft: status === "active" || status === "frozen" ? daysUntil(expiresAt) : null,
      visitsLeft,
      lastVisit: lastVisitMap.get(c.id) ?? null,
      debt,
      status,
    }
  })

  const stats: ClientsStats = {
    total: totalCount ?? rows.length,
    active: rows.filter((r) => r.status === "active").length,
    expiring: rows.filter((r) => r.status === "active" && r.daysLeft !== null && r.daysLeft <= 7).length,
    debt: rows.reduce((sum, r) => sum + r.debt, 0),
  }

  return { rows, stats }
}

// ── Серверная пагинация ───────────────────────────────────────
export type ClientsQuery = {
  search?: string
  status?: string[]      // active | expiring | expired | frozen (мультивыбор)
  membership?: string[]  // имена абонементов (мультивыбор)
  days?: string[]        // 0-3 | 4-7 | 8-14 | 14+ (мультивыбор)
  sort?: string          // name_asc | name_desc | expires_asc | expires_desc | debt_desc | created_asc
  page?: number          // 0-based
  pageSize?: number       // default 50
}

export type ClientsPageResult = {
  rows: ClientRow[]
  total: number
  page: number
  pageSize: number
  stats: ClientsStats
  membershipNames: string[]
  serverPaginated: boolean
}

export const CLIENTS_PAGE_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRpcRow(r: any): ClientRow {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    birthDate: r.birth_date ?? null,
    gender: r.gender ?? null,
    source: r.source ?? null,
    membership: r.membership ?? null,
    expiresAt: r.expires_at ?? null,
    daysLeft: r.days_left ?? null,
    visitsLeft: r.visits_left ?? null,
    lastVisit: r.last_visit ?? null,
    debt: Number(r.debt ?? 0),
    status: (r.status as ClientStatus) ?? "none",
  }
}

async function getMembershipNames(supabase: SupabaseClient, clubId: string): Promise<string[]> {
  const { data } = await supabase
    .from("memberships")
    .select("name")
    .eq("club_id", clubId)
    .order("name")
  const set = new Set<string>()
  for (const m of (data ?? []) as { name: string | null }[]) if (m.name) set.add(m.name)
  return [...set]
}

/**
 * Страница клиентов с сервера (RPC clients_page/clients_stats). Если функции ещё
 * не созданы (миграция не применена) — прозрачный fallback на getClientsData
 * с фильтрацией/пагинацией в памяти, чтобы приложение не ломалось.
 */
export async function getClientsPage(
  supabase: SupabaseClient,
  clubId: string,
  q: ClientsQuery,
): Promise<ClientsPageResult> {
  const pageSize = q.pageSize ?? CLIENTS_PAGE_SIZE
  const page = Math.max(0, q.page ?? 0)

  const rpcArgs = {
    p_club_id: clubId,
    p_search: q.search?.trim() || null,
    p_statuses: q.status?.length ? q.status : null,
    p_memberships: q.membership?.length ? q.membership : null,
    p_days: q.days?.length ? q.days : null,
    p_sort: q.sort || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  }

  const [pageRes, statsRes, membershipNames] = await Promise.all([
    supabase.rpc("clients_page", rpcArgs),
    supabase.rpc("clients_stats", { p_club_id: clubId }),
    getMembershipNames(supabase, clubId),
  ])

  // RPC отсутствует / ошибка → fallback в память.
  if (pageRes.error) {
    return inMemoryClientsPage(supabase, clubId, q, pageSize, page, membershipNames)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data = (pageRes.data ?? []) as any[]
  let total = data.length > 0 ? Number(data[0].total_count) : 0

  // Страница за пределами набора (например, вручную введён ?page=999): вернём первую.
  if (data.length === 0 && page > 0) {
    const retry = await supabase.rpc("clients_page", { ...rpcArgs, p_offset: 0 })
    if (!retry.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data = (retry.data ?? []) as any[]
      total = data.length > 0 ? Number(data[0].total_count) : 0
    }
  }

  const s = (statsRes.data?.[0] ?? null) as { total: number; active: number; expiring: number; debt: number } | null
  const stats: ClientsStats = s
    ? { total: Number(s.total), active: Number(s.active), expiring: Number(s.expiring), debt: Number(s.debt) }
    : { total, active: 0, expiring: 0, debt: 0 }

  return {
    rows: data.map(mapRpcRow),
    total,
    page: data.length === 0 && page > 0 ? 0 : page,
    pageSize,
    stats,
    membershipNames,
    serverPaginated: true,
  }
}

/**
 * Все клиенты с учётом фильтров — для экспорта. Ответ RPC ограничен 1000 строк
 * (max-rows PostgREST), поэтому догружаем батчами по 1000 через offset.
 */
export async function getClientsForExport(
  supabase: SupabaseClient,
  clubId: string,
  q: ClientsQuery,
): Promise<ClientRow[]> {
  const SIZE = 1000
  const baseArgs = {
    p_club_id: clubId,
    p_search: q.search?.trim() || null,
    p_statuses: q.status?.length ? q.status : null,
    p_memberships: q.membership?.length ? q.membership : null,
    p_days: q.days?.length ? q.days : null,
    p_sort: q.sort || null,
    p_limit: SIZE,
  }

  const first = await supabase.rpc("clients_page", { ...baseArgs, p_offset: 0 })
  if (first.error) {
    // Fallback: RPC ещё не создан — берём всё в память и фильтруем.
    const res = await inMemoryClientsPage(supabase, clubId, q, 1_000_000, 0, [])
    return res.rows
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data = (first.data ?? []) as any[]
  const total = data.length > 0 ? Number(data[0].total_count) : 0
  const all: ClientRow[] = data.map(mapRpcRow)

  let offset = SIZE
  while (all.length < total && data.length === SIZE && offset < 500_000) {
    const next = await supabase.rpc("clients_page", { ...baseArgs, p_offset: offset })
    if (next.error) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data = (next.data ?? []) as any[]
    all.push(...data.map(mapRpcRow))
    offset += SIZE
  }
  return all
}

function matchStatusRow(r: ClientRow, status: string): boolean {
  if (status === "active") return r.status === "active"
  if (status === "frozen") return r.status === "frozen"
  if (status === "expired") return r.status === "expired"
  if (status === "expiring") return r.status === "active" && r.daysLeft !== null && r.daysLeft <= 7
  return true
}
function matchDaysRow(r: ClientRow, days: string): boolean {
  const d = r.daysLeft
  if (d === null) return false
  if (days === "0-3") return d >= 0 && d <= 3
  if (days === "4-7") return d >= 4 && d <= 7
  if (days === "8-14") return d >= 8 && d <= 14
  if (days === "14+") return d > 14
  return true
}

async function inMemoryClientsPage(
  supabase: SupabaseClient,
  clubId: string,
  q: ClientsQuery,
  pageSize: number,
  page: number,
  membershipNames: string[],
): Promise<ClientsPageResult> {
  const { rows, stats } = await getClientsData(supabase, clubId)
  const search = q.search?.trim().toLowerCase() ?? ""
  let filtered = rows.filter((r) => {
    if (search && !(r.name.toLowerCase().includes(search) || (r.phone ?? "").toLowerCase().includes(search))) return false
    if (q.status?.length && !q.status.some((s) => matchStatusRow(r, s))) return false
    if (q.membership?.length && !(r.membership && q.membership.includes(r.membership))) return false
    if (q.days?.length && !q.days.some((d) => matchDaysRow(r, d))) return false
    return true
  })
  const sort = q.sort
  if (sort === "name_asc") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === "name_desc") filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name))
  else if (sort === "expires_asc") filtered = [...filtered].sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""))
  else if (sort === "expires_desc") filtered = [...filtered].sort((a, b) => (b.expiresAt ?? "").localeCompare(a.expiresAt ?? ""))
  else if (sort === "debt_desc") filtered = [...filtered].sort((a, b) => b.debt - a.debt)

  const total = filtered.length
  const start = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1)) * pageSize
  return {
    rows: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    stats: { ...stats, total: stats.total },
    membershipNames: membershipNames.length ? membershipNames : Array.from(new Set(rows.map((r) => r.membership).filter((m): m is string => !!m))),
    serverPaginated: false,
  }
}
