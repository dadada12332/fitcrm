import { createServiceClient } from "@/lib/supabase/service"

export type Provider = "click" | "payme"

export type ConnectionRequest = {
  id: string
  clubId: string
  clubName: string
  provider: Provider
  status: "new" | "active" | "rejected" | "cancelled"
  requestedEmail: string | null
  createdAt: string
  resolvedAt: string | null
  enabled: boolean
  credMeta: Record<string, string>
}

const STATUS_ORDER: Record<string, number> = { new: 0, active: 1, rejected: 2, cancelled: 3 }

/** Все заявки на подключение платёжек (для Platform Admin). Service-role. */
export async function getConnectionRequests(): Promise<{ pending: ConnectionRequest[]; resolved: ConnectionRequest[] }> {
  const s = createServiceClient()
  const [{ data: reqs }, { data: clubs }, { data: creds }] = await Promise.all([
    s.from("payment_connection_requests").select("id, club_id, provider, status, requested_email, created_at, resolved_at").order("created_at", { ascending: false }),
    s.from("clubs").select("id, name"),
    s.from("club_payment_credentials").select("club_id, provider, enabled, meta"),
  ])
  const clubName = new Map((clubs ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const credMap = new Map((creds ?? []).map((c: { club_id: string; provider: string; enabled: boolean; meta: Record<string, string> }) => [`${c.club_id}:${c.provider}`, c]))

  const rows: ConnectionRequest[] = (reqs ?? []).map((r: {
    id: string; club_id: string; provider: Provider; status: ConnectionRequest["status"]
    requested_email: string | null; created_at: string; resolved_at: string | null
  }) => {
    const cr = credMap.get(`${r.club_id}:${r.provider}`)
    return {
      id: r.id, clubId: r.club_id, clubName: clubName.get(r.club_id) ?? "—",
      provider: r.provider, status: r.status, requestedEmail: r.requested_email,
      createdAt: r.created_at, resolvedAt: r.resolved_at,
      enabled: cr?.enabled ?? false, credMeta: cr?.meta ?? {},
    }
  })
  rows.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (a.createdAt < b.createdAt ? 1 : -1))
  return {
    pending: rows.filter((r) => r.status === "new"),
    resolved: rows.filter((r) => r.status !== "new"),
  }
}

/** Не-секретная мета кредов клуба (для формы редактирования). Service-role. */
export async function getCredentialMeta(clubId: string, provider: Provider): Promise<Record<string, string>> {
  const s = createServiceClient()
  const { data } = await s.from("club_payment_credentials").select("meta").eq("club_id", clubId).eq("provider", provider).maybeSingle()
  return (data?.meta as Record<string, string>) ?? {}
}
