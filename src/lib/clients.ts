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

export async function getClientsData(supabase: SupabaseClient): Promise<ClientsData> {
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, gender, birth_date, source, created_at, subscriptions(status, expires_at, memberships(name))")
    .order("created_at", { ascending: false })

  const clients = (data ?? []) as {
    id: string
    full_name: string
    phone: string | null
    gender: string | null
    birth_date: string | null
    source: string | null
    subscriptions: SubRow[] | null
  }[]

  const rows: ClientRow[] = clients.map((c) => {
    const sub = pickSubscription(c.subscriptions ?? [])
    const status: ClientStatus = (sub?.status as ClientStatus) ?? "none"
    const expiresAt = sub?.expires_at ?? null
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
      status,
    }
  })

  const stats: ClientsStats = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    expiring: rows.filter((r) => r.status === "active" && r.daysLeft !== null && r.daysLeft <= 7).length,
    debt: 0,
  }

  return { rows, stats }
}
