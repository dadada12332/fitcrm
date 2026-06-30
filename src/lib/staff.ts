import type { SupabaseClient } from "@supabase/supabase-js"

export type StaffStatus = "active" | "vacation" | "fired"
export type SalaryType  = "fixed" | "percent" | "mixed"

export type StaffSettings = {
  phone?:        string
  dob?:          string
  hired_at?:     string
  status?:       StaffStatus
  photo_url?:    string
  salary_type?:  SalaryType
  salary_fixed?: number
  salary_percent?: number
  permissions?: {
    clients?:   boolean
    visits?:    boolean
    payments?:  boolean
    inventory?: boolean
    finance?:   boolean
    settings?:  boolean
  }
  salary_history?: { date: string; amount: number; note?: string }[]
}

export type StaffRow = {
  id:           string
  userId:       string
  role:         string
  name:         string
  email:        string
  isActive:     boolean
  salary:       number
  clientCount:  number
  revenue:      number
  status:       StaffStatus
  settings:     StaffSettings
}

export type StaffKPI = {
  total:         number
  trainers:      number
  admins:        number
  monthlySalary: number
}

export type StaffClient = {
  id:             string
  name:           string
  membershipName: string | null
  status:         string
}

export type ScheduleSlot = {
  id:        string
  title:     string
  dayOfWeek: number
  startTime: string
  endTime:   string
}

export type StaffDetail = StaffRow & {
  clients:       StaffClient[]
  schedule:      ScheduleSlot[]
  personalCount: number
  personalRevenue: number
  renewals:      number
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", manager: "Менеджер", admin: "Администратор",
  trainer: "Тренер", accountant: "Бухгалтер",
}

export { ROLE_LABELS }

export async function getStaffKPI(supabase: SupabaseClient, clubId: string): Promise<StaffKPI> {
  const { data: staffData } = await supabase
    .from("staff")
    .select("role, salary, is_active")
    .eq("club_id", clubId)

  const list = staffData ?? []
  const active = list.filter((s: any) => s.is_active)

  return {
    total:         active.length,
    trainers:      active.filter((s: any) => s.role === "trainer").length,
    admins:        active.filter((s: any) => ["admin", "manager"].includes(s.role)).length,
    monthlySalary: active.reduce((sum: number, s: any) => sum + (Number(s.salary) || 0), 0),
  }
}

export async function getStaffList(supabase: SupabaseClient, clubId: string): Promise<StaffRow[]> {
  const [staffRes, visitsRes] = await Promise.all([
    supabase.from("staff").select("id, user_id, role, salary, is_active, settings").eq("club_id", clubId),
    supabase.from("visits").select("staff_id, client_id").eq("club_id", clubId).not("staff_id", "is", null),
  ])

  const staffRows: any[] = staffRes.data ?? []
  const visits: any[]    = visitsRes.data ?? []

  const userIds = [...new Set(staffRows.map((s: any) => s.user_id as string))]
  const usersMap = new Map<string, { email: string; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, email, full_name")
      .in("id", userIds)
    for (const u of usersData ?? []) usersMap.set(u.id, u)
  }

  return staffRows.map((s: any) => {
    const u        = usersMap.get(s.user_id)
    const settings: StaffSettings = (s.settings as StaffSettings) ?? {}
    const myVisits  = visits.filter((v: any) => v.staff_id === s.id)
    const clientIds = [...new Set(myVisits.map((v: any) => v.client_id as string))]

    return {
      id:          s.id,
      userId:      s.user_id,
      role:        s.role,
      name:        u?.full_name ?? u?.email?.split("@")[0] ?? "—",
      email:       u?.email ?? "",
      isActive:    s.is_active,
      salary:      Number(s.salary) || 0,
      clientCount: clientIds.length,
      revenue:     0,
      status:      (settings.status ?? (s.is_active ? "active" : "fired")) as StaffStatus,
      settings,
    }
  })
}

export async function getStaffMember(supabase: SupabaseClient, id: string, clubId: string): Promise<StaffDetail | null> {
  const [staffRes, visitsRes, schedRes] = await Promise.all([
    supabase.from("staff").select("id, user_id, role, salary, is_active, settings").eq("id", id).eq("club_id", clubId).single(),
    supabase.from("visits").select("client_id, created_at, subscription_id, subscriptions(membership_id, memberships(name), status)")
      .eq("club_id", clubId).eq("staff_id", id),
    supabase.from("schedules").select("id, title, day_of_week, start_time, end_time").eq("club_id", clubId).eq("staff_id", id).eq("is_active", true),
  ])

  const s = staffRes.data
  if (!s) return null

  const { data: userData } = await supabase.from("users").select("id, email, full_name").eq("id", s.user_id).single()
  const u        = userData
  const settings = (s.settings as StaffSettings) ?? {}
  const visits: any[] = visitsRes.data ?? []

  const clientMap = new Map<string, { name: string; membershipName: string | null; status: string }>()
  for (const v of visits) {
    if (!v.client_id || clientMap.has(v.client_id)) continue
    const sub = Array.isArray(v.subscriptions) ? v.subscriptions[0] : v.subscriptions
    const mem = sub ? (Array.isArray(sub.memberships) ? sub.memberships[0] : sub.memberships) : null
    clientMap.set(v.client_id, {
      name:           v.client_id,
      membershipName: mem?.name ?? null,
      status:         sub?.status ?? "active",
    })
  }

  const clientIds = [...clientMap.keys()]
  let clientNames: { id: string; full_name: string }[] = []
  if (clientIds.length > 0) {
    const { data: cn } = await supabase.from("clients").select("id, full_name").eq("club_id", clubId).in("id", clientIds)
    clientNames = cn ?? []
  }

  const clients: StaffClient[] = clientNames.map((c) => ({
    id:             c.id,
    name:           c.full_name,
    membershipName: clientMap.get(c.id)?.membershipName ?? null,
    status:         clientMap.get(c.id)?.status ?? "active",
  }))

  const schedule: ScheduleSlot[] = (schedRes.data ?? []).map((r: any) => ({
    id:        r.id,
    title:     r.title,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime:   r.end_time,
  }))

  const base: StaffRow = {
    id:          s.id,
    userId:      s.user_id,
    role:        s.role,
    name:        u?.full_name ?? u?.email?.split("@")[0] ?? "—",
    email:       u?.email ?? "",
    isActive:    s.is_active,
    salary:      Number(s.salary) || 0,
    clientCount: clients.length,
    revenue:     0,
    status:      (settings.status ?? (s.is_active ? "active" : "fired")) as StaffStatus,
    settings,
  }

  return {
    ...base,
    clients,
    schedule,
    personalCount:   visits.length,
    personalRevenue: 0,
    renewals:        0,
  }
}
