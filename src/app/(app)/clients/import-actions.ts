"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { revalidatePath } from "next/cache"
import type { DuplicateStrategy } from "@/lib/import-wizard"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

export interface ImportClientRow {
  _rowIndex: number
  full_name?: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  birth_date?: string
  gender?: string
  source?: string
  notes?: string
  balance?: string
  debt?: string
  trainer?: string
  membership_name?: string
  sub_status?: string
  sub_start?: string
  sub_end?: string
  visits_total?: string
  last_visit?: string
}

export interface ImportAudit {
  clientsInserted: number
  clientsUpdated: number
  subscriptionsCreated: number
  subscriptionsUpdated: number
  membershipsMatched: number
  membershipsCreated: number
  visitsCreated: number
  trainersLinked: number
  trainersUnmatched: number
  financialsSet: number
  /** true when balance/debt/trainer columns exist on the clients table */
  financialColumns: boolean
}

export interface BatchImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ row: number; reason: string; name: string }>
  audit: ImportAudit
}

function emptyAudit(): ImportAudit {
  return {
    clientsInserted: 0, clientsUpdated: 0,
    subscriptionsCreated: 0, subscriptionsUpdated: 0,
    membershipsMatched: 0, membershipsCreated: 0,
    visitsCreated: 0, trainersLinked: 0, trainersUnmatched: 0,
    financialsSet: 0, financialColumns: true,
  }
}

export async function checkPhonesAction(phones: string[]): Promise<string[]> {
  if (!phones.length) return []
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  const { data } = await supabase
    .from("clients")
    .select("phone")
    .eq("club_id", club.clubId)
    .in("phone", phones)
  return (data ?? []).map((r) => r.phone).filter(Boolean) as string[]
}

export async function batchImportClientsAction(
  rows: ImportClientRow[],
  strategy: DuplicateStrategy,
  existingPhones: string[],
): Promise<BatchImportResult> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  const audit = emptyAudit()
  if (!club) return { imported: 0, updated: 0, skipped: 0, errors: [], audit }

  const clubId = club.clubId
  const result: BatchImportResult = { imported: 0, updated: 0, skipped: 0, errors: [], audit }
  const dupSet = new Set(existingPhones)

  const toInsert: ImportClientRow[] = []
  const toUpdate: ImportClientRow[] = []

  for (const row of rows) {
    const isDup = row.phone && dupSet.has(row.phone)
    if (isDup) {
      if (strategy === "skip")   { result.skipped++; continue }
      if (strategy === "update") { toUpdate.push(row); continue }
    }
    toInsert.push(row)
  }

  // Shared lookups built once per batch
  const membershipMap = await resolveMemberships(supabase, clubId, [...toInsert, ...toUpdate], audit)
  const trainerMap    = await fetchTrainers(supabase, clubId)

  // ── Phase 1: INSERT new clients (fresh — no existing sub/visit) ────────────
  const insertedPairs: Array<{ id: string; row: ImportClientRow }> = []
  if (toInsert.length > 0) {
    const { records, financialColumns } = buildClientInsertRecords(toInsert, clubId, trainerMap, audit)
    audit.financialColumns = financialColumns

    const res = await insertClientsReturning(supabase, records, financialColumns, toInsert, clubId, trainerMap, audit)
    if (res.error) {
      for (const r of toInsert) {
        result.errors.push({ row: r._rowIndex, reason: res.error, name: buildName(r) || "—" })
      }
    }
    const data = res.data
    if (data) {
      result.imported += data.length
      audit.clientsInserted += data.length
      data.forEach((ins, i) => {
        const row = toInsert[i]
        if (hasSubscriptionData(row) || row.last_visit) insertedPairs.push({ id: ins.id, row })
      })
    }
  }

  // ── Phase 2: UPDATE existing clients (repair — may already have sub/visit) ─
  const updatedPairs: Array<{ id: string; row: ImportClientRow }> = []
  if (toUpdate.length > 0) {
    const PARALLEL = 25
    for (let i = 0; i < toUpdate.length; i += PARALLEL) {
      const batch = toUpdate.slice(i, i + PARALLEL)
      const settled = await Promise.all(batch.map((row) => updateOneClient(supabase, clubId, row, trainerMap, audit, result)))
      for (const r of settled) if (r) updatedPairs.push(r)
    }
    result.updated += audit.clientsUpdated
  }

  // ── Phase 3: Subscriptions + Visits for freshly INSERTED clients ──────────
  if (insertedPairs.length > 0) {
    await createSubscriptionsBulk(supabase, clubId, insertedPairs, membershipMap, audit)
    await createVisitsBulk(supabase, clubId, insertedPairs, audit)
  }

  // ── Phase 4: Subscriptions + Visits for UPDATED clients (repair) ──────────
  if (updatedPairs.length > 0) {
    await repairSubscriptions(supabase, clubId, updatedPairs, membershipMap, audit)
    await repairVisits(supabase, clubId, updatedPairs, audit)
  }

  revalidatePath("/clients")
  return result
}

// ── Client insert helpers ──────────────────────────────────────────────────

function buildClientInsertRecords(
  rows: ImportClientRow[],
  clubId: string,
  trainerMap: Map<string, string>,
  audit: ImportAudit,
  forceBase = false,
): { records: DB[]; financialColumns: boolean } {
  const financialColumns = !forceBase
  const records = rows.map((r) => {
    const base: DB = {
      club_id:    clubId,
      full_name:  buildName(r),
      phone:      r.phone      || null,
      email:      r.email      || null,
      birth_date: parseDate(r.birth_date),
      gender:     normalizeGender(r.gender),
      source:     r.source     || null,
      notes:      r.notes      || null,
      tags:       [],
    }
    if (financialColumns) {
      const balance = parseMoney(r.balance)
      const debt    = parseMoney(r.debt)
      if (balance > 0 || debt > 0) audit.financialsSet++
      base.balance = balance
      base.debt    = debt
      if (r.trainer) {
        base.trainer_name = r.trainer
        const tid = resolveTrainerId(r.trainer, trainerMap)
        if (tid) { base.trainer_id = tid; audit.trainersLinked++ }
        else audit.trainersUnmatched++
      }
    }
    return base
  })
  return { records, financialColumns }
}

async function insertClientsReturning(
  supabase: DB,
  records: DB[],
  financialColumns: boolean,
  rows: ImportClientRow[],
  clubId: string,
  trainerMap: Map<string, string>,
  audit: ImportAudit,
): Promise<{ data: Array<{ id: string }> | null; error: string | null }> {
  const { data, error } = await supabase.from("clients").insert(records).select("id")
  if (error && isMissingColumn(error) && financialColumns) {
    audit.financialColumns = false
    audit.financialsSet = 0
    audit.trainersLinked = 0
    const base = buildClientInsertRecords(rows, clubId, trainerMap, audit, true)
    const retry = await supabase.from("clients").insert(base.records).select("id")
    return { data: retry.data ?? null, error: retry.error ? retry.error.message : null }
  }
  return { data: data ?? null, error: error ? error.message : null }
}

async function updateOneClient(
  supabase: DB,
  clubId: string,
  row: ImportClientRow,
  trainerMap: Map<string, string>,
  audit: ImportAudit,
  result: BatchImportResult,
): Promise<{ id: string; row: ImportClientRow } | null> {
  const patch: DB = {
    full_name:  buildName(row),
    email:      row.email  || null,
    birth_date: parseDate(row.birth_date),
    gender:     normalizeGender(row.gender),
    source:     row.source || null,
    notes:      row.notes  || null,
  }
  if (audit.financialColumns) {
    const balance = parseMoney(row.balance)
    const debt    = parseMoney(row.debt)
    if (balance > 0 || debt > 0) audit.financialsSet++
    patch.balance = balance
    patch.debt    = debt
    if (row.trainer) {
      patch.trainer_name = row.trainer
      const tid = resolveTrainerId(row.trainer, trainerMap)
      if (tid) { patch.trainer_id = tid; audit.trainersLinked++ }
      else audit.trainersUnmatched++
    }
  }

  let { data, error } = await supabase
    .from("clients").update(patch).eq("club_id", clubId).eq("phone", row.phone!).select("id")

  if (error && isMissingColumn(error) && audit.financialColumns) {
    audit.financialColumns = false
    const base: DB = {
      full_name: buildName(row), email: row.email || null,
      birth_date: parseDate(row.birth_date), gender: normalizeGender(row.gender),
      source: row.source || null, notes: row.notes || null,
    }
    ;({ data, error } = await supabase
      .from("clients").update(base).eq("club_id", clubId).eq("phone", row.phone!).select("id"))
  }

  if (error) {
    result.errors.push({ row: row._rowIndex, reason: error.message, name: buildName(row) || "—" })
    return null
  }
  audit.clientsUpdated++
  const id = data?.[0]?.id
  if (id && (hasSubscriptionData(row) || row.last_visit)) return { id, row }
  return null
}

// ── Membership resolution (find-or-create — NEVER random) ───────────────────

async function resolveMemberships(
  supabase: DB,
  clubId: string,
  rows: ImportClientRow[],
  audit: ImportAudit,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const wanted = [...new Set(
    rows.map((r) => r.membership_name?.trim()).filter((n): n is string => !!n),
  )]
  if (wanted.length === 0) return map

  // Fetch existing memberships for the club
  const { data: existing } = await supabase
    .from("memberships").select("id, name").eq("club_id", clubId)
  for (const m of (existing ?? []) as Array<{ id: string; name: string }>) {
    map.set(m.name.trim().toLowerCase(), m.id)
  }

  // Determine which names are missing and create them
  const missing = wanted.filter((n) => !map.has(n.toLowerCase()))
  audit.membershipsMatched += wanted.length - missing.length

  if (missing.length > 0) {
    const newRecords = missing.map((name) => ({
      club_id: clubId,
      name,
      price: 0,
      duration_days: 30,
      visits_limit: null,
      is_active: true,
    }))
    const { data: created } = await supabase.from("memberships").insert(newRecords).select("id, name")
    for (const m of (created ?? []) as Array<{ id: string; name: string }>) {
      map.set(m.name.trim().toLowerCase(), m.id)
      audit.membershipsCreated++
    }
  }
  return map
}

// ── Trainer resolution (staff by user full_name) ────────────────────────────

async function fetchTrainers(supabase: DB, clubId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data } = await supabase
    .from("staff").select("id, users(full_name)").eq("club_id", clubId).eq("is_active", true)
  for (const s of (data ?? []) as Array<{ id: string; users: { full_name: string | null } | { full_name: string | null }[] | null }>) {
    const u = Array.isArray(s.users) ? s.users[0] : s.users
    const name = u?.full_name?.trim().toLowerCase()
    if (name) map.set(name, s.id)
  }
  return map
}

function resolveTrainerId(name: string, map: Map<string, string>): string | null {
  const key = name.trim().toLowerCase()
  if (map.has(key)) return map.get(key)!
  // token-overlap fallback: match if trainer first name matches a staff name token
  for (const [staffName, id] of map) {
    if (staffName.includes(key) || key.includes(staffName)) return id
  }
  return null
}

// ── Subscription creation (fresh inserts) ───────────────────────────────────

async function createSubscriptionsBulk(
  supabase: DB,
  clubId: string,
  pairs: Array<{ id: string; row: ImportClientRow }>,
  membershipMap: Map<string, string>,
  audit: ImportAudit,
) {
  const records = pairs
    .filter(({ row }) => hasSubscriptionData(row))
    .map(({ id, row }) => buildSubRecord(clubId, id, row, membershipMap))
  if (records.length > 0) {
    const { error } = await supabase.from("subscriptions").insert(records)
    if (!error) audit.subscriptionsCreated += records.length
  }
}

async function repairSubscriptions(
  supabase: DB,
  clubId: string,
  pairs: Array<{ id: string; row: ImportClientRow }>,
  membershipMap: Map<string, string>,
  audit: ImportAudit,
) {
  const withSub = pairs.filter(({ row }) => hasSubscriptionData(row))
  if (withSub.length === 0) return
  const clientIds = withSub.map((p) => p.id)

  // Latest existing subscription per client
  const { data: existing } = await supabase
    .from("subscriptions").select("id, client_id, created_at")
    .in("client_id", clientIds).order("created_at", { ascending: false })
  const latest = new Map<string, string>()
  for (const s of (existing ?? []) as Array<{ id: string; client_id: string }>) {
    if (!latest.has(s.client_id)) latest.set(s.client_id, s.id)
  }

  const toInsert: DB[] = []
  const updates: Array<{ subId: string; patch: DB }> = []
  for (const { id, row } of withSub) {
    const rec = buildSubRecord(clubId, id, row, membershipMap)
    const subId = latest.get(id)
    if (subId) {
      // patch existing — do not overwrite club/client
      const { club_id, client_id, ...patch } = rec // eslint-disable-line @typescript-eslint/no-unused-vars
      updates.push({ subId, patch })
    } else {
      toInsert.push(rec)
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("subscriptions").insert(toInsert)
    if (!error) audit.subscriptionsCreated += toInsert.length
  }
  const PARALLEL = 25
  for (let i = 0; i < updates.length; i += PARALLEL) {
    const batch = updates.slice(i, i + PARALLEL)
    const done = await Promise.all(batch.map(async ({ subId, patch }) => {
      const { error } = await supabase.from("subscriptions").update(patch).eq("id", subId)
      return !error
    }))
    audit.subscriptionsUpdated += done.filter(Boolean).length
  }
}

function buildSubRecord(clubId: string, clientId: string, row: ImportClientRow, membershipMap: Map<string, string>): DB {
  const nameLower = row.membership_name?.trim().toLowerCase() ?? ""
  const membershipId = nameLower ? (membershipMap.get(nameLower) ?? null) : null
  const remaining = row.visits_total != null && row.visits_total !== "" ? parseIntSafe(row.visits_total) : null
  const startsAt = parseDate(row.sub_start) ?? new Date().toISOString().slice(0, 10)
  const expiresAt = parseDate(row.sub_end) ?? null
  const status = deriveSubStatus(row.sub_status, expiresAt)
  return {
    club_id:       clubId,
    client_id:     clientId,
    membership_id: membershipId,
    starts_at:     startsAt,
    expires_at:    expiresAt,
    visits_total:  remaining,
    visits_used:   0,
    status,
  }
}

// ── Visit creation (last visit → history row) ───────────────────────────────

async function createVisitsBulk(
  supabase: DB,
  clubId: string,
  pairs: Array<{ id: string; row: ImportClientRow }>,
  audit: ImportAudit,
) {
  const records = pairs
    .map(({ id, row }) => {
      const at = parseDateTime(row.last_visit)
      return at ? { club_id: clubId, client_id: id, checked_in_at: at, method: "manual" } : null
    })
    .filter(Boolean) as DB[]
  if (records.length > 0) {
    const { error } = await supabase.from("visits").insert(records)
    if (!error) audit.visitsCreated += records.length
  }
}

async function repairVisits(
  supabase: DB,
  clubId: string,
  pairs: Array<{ id: string; row: ImportClientRow }>,
  audit: ImportAudit,
) {
  const withVisit = pairs.filter(({ row }) => !!parseDateTime(row.last_visit))
  if (withVisit.length === 0) return
  const clientIds = withVisit.map((p) => p.id)
  // Skip clients who already have visits (avoid duplicate history on re-import)
  const { data: existing } = await supabase
    .from("visits").select("client_id").in("client_id", clientIds)
  const has = new Set((existing ?? []).map((v: { client_id: string }) => v.client_id))
  const records = withVisit
    .filter((p) => !has.has(p.id))
    .map(({ id, row }) => ({ club_id: clubId, client_id: id, checked_in_at: parseDateTime(row.last_visit)!, method: "manual" }))
  if (records.length > 0) {
    const { error } = await supabase.from("visits").insert(records)
    if (!error) audit.visitsCreated += records.length
  }
}

// ── Predicates & parsing ────────────────────────────────────────────────────

function hasSubscriptionData(r: ImportClientRow): boolean {
  return !!(r.membership_name || r.sub_start || r.sub_end || (r.visits_total != null && r.visits_total !== "") || r.sub_status)
}

function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message ?? "")
}

function buildName(r: ImportClientRow): string {
  return r.full_name || [r.last_name, r.first_name].filter(Boolean).join(" ")
}

function deriveSubStatus(v: string | undefined, expiresAt: string | null): "active" | "expired" | "frozen" | "cancelled" {
  const explicit = normalizeSubStatus(v)
  if (explicit) return explicit
  if (expiresAt && expiresAt < new Date().toISOString().slice(0, 10)) return "expired"
  return "active"
}

function normalizeSubStatus(v?: string): "active" | "expired" | "frozen" | "cancelled" | null {
  if (!v) return null
  const l = v.toLowerCase().trim()
  if (["активен", "active", "действует", "действителен", "активный"].includes(l)) return "active"
  if (["просрочен", "expired", "истёк", "истек", "закончился", "истекший"].includes(l)) return "expired"
  if (["заморожен", "frozen", "заморожено", "заморозка"].includes(l)) return "frozen"
  if (["отменён", "отменен", "cancelled", "canceled"].includes(l)) return "cancelled"
  return null
}

function normalizeGender(v?: string): string | null {
  if (!v) return null
  const l = v.toLowerCase().trim()
  if (["м", "m", "male", "мужской", "мужчина", "муж"].includes(l)) return "male"
  if (["ж", "f", "female", "женский", "женщина", "жен"].includes(l)) return "female"
  return null
}

function parseMoney(v?: string): number {
  if (!v?.trim()) return 0
  const n = parseFloat(v.replace(/\s/g, "").replace(/[^\d.,-]/g, "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

function parseIntSafe(v?: string): number | null {
  if (!v?.trim()) return null
  const n = parseInt(v.replace(/[^\d-]/g, ""), 10)
  return isNaN(n) ? null : n
}

function parseDate(v?: string): string | null {
  if (!v?.trim()) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m1 = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`
  const m2 = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`
  return null
}

/** Last-visit may include time; fall back to date-only → midnight. Returns ISO timestamp. */
function parseDateTime(v?: string): string | null {
  if (!v?.trim()) return null
  const s = v.trim()
  // Try native parse for ISO-like values with time
  const native = Date.parse(s)
  if (!isNaN(native) && /[:t]/i.test(s)) return new Date(native).toISOString()
  const d = parseDate(s)
  return d ? new Date(`${d}T12:00:00`).toISOString() : null
}
