"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import {
  mergeImportData,
  normalizeImportEmail,
  normalizeImportPhone,
  parseImportDate,
  parseImportDateTime,
  parseImportInteger,
  parseImportMoney,
  type ImportExtraFields,
} from "@/lib/client-import"
import { can } from "@/lib/permissions"
import { consumeMonthlyLimitOnce, requirePlanFeature, requireRecordLimit } from "@/lib/plan-enforcement"
import { createClient } from "@/lib/supabase/server"
import type { DuplicateStrategy } from "@/lib/import-wizard"

// Supabase's generated database types are not present in this repository yet.
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
  extra_fields?: ImportExtraFields
  source_file?: string
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
  financialColumns: boolean
  extraFieldsSaved: number
  rowsMerged: number
}

export interface BatchImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ row: number; reason: string; name: string }>
  audit: ImportAudit
}

type ExistingClient = {
  id: string
  phone_normalized: string | null
  email_normalized: string | null
  import_data: unknown
}

type ClientPair = { id: string; row: ImportClientRow }

function emptyAudit(): ImportAudit {
  return {
    clientsInserted: 0, clientsUpdated: 0,
    subscriptionsCreated: 0, subscriptionsUpdated: 0,
    membershipsMatched: 0, membershipsCreated: 0,
    visitsCreated: 0, trainersLinked: 0, trainersUnmatched: 0,
    financialsSet: 0, financialColumns: true,
    extraFieldsSaved: 0, rowsMerged: 0,
  }
}

export async function checkPhonesAction(phones: string[]): Promise<string[]> {
  const club = await getCurrentClub()
  if (!club || !phones.length) return []
  const supabase = await createClient()
  const normalizedToRaw = new Map<string, string[]>()
  for (const phone of phones.slice(0, 15_000)) {
    const normalized = normalizeImportPhone(phone)
    if (normalized) normalizedToRaw.set(normalized, [...(normalizedToRaw.get(normalized) ?? []), phone])
  }
  const found = new Set<string>()
  for (const values of chunks([...normalizedToRaw.keys()], 100)) {
    const { data } = await supabase
      .from("clients")
      .select("phone_normalized")
      .eq("club_id", club.clubId)
      .in("phone_normalized", values)
    for (const item of (data ?? []) as Array<{ phone_normalized: string | null }>) {
      if (item.phone_normalized) found.add(item.phone_normalized)
    }
  }
  return [...found].flatMap((phone) => normalizedToRaw.get(phone) ?? [])
}

export async function batchImportClientsAction(
  inputRows: ImportClientRow[],
  strategy: DuplicateStrategy,
  importSessionId: string,
): Promise<BatchImportResult> {
  const club = await getCurrentClub()
  const audit = emptyAudit()
  const result: BatchImportResult = { imported: 0, updated: 0, skipped: 0, errors: [], audit }
  if (!club) return result
  if (!can(club.permissions, "clients", "create")) return denied(result)
  if (strategy === "update" && !can(club.permissions, "clients", "edit")) return denied(result)
  const featureError = requirePlanFeature(club, "import")
  if (featureError) {
    result.errors.push({ row: 0, reason: featureError, name: "" })
    return result
  }
  const usageError = await consumeMonthlyLimitOnce(club, "imports", importSessionId)
  if (usageError) {
    result.errors.push({ row: 0, reason: usageError, name: "" })
    return result
  }
  if (inputRows.length > 1_000) {
    result.errors.push({ row: 0, reason: "За один запрос можно импортировать не более 1000 строк", name: "" })
    return result
  }

  const supabase = await createClient()
  const clubId = club.clubId
  const validRows: ImportClientRow[] = []
  for (const raw of inputRows) {
    const row = cleanRow(raw)
    const errors = validateRow(row)
    if (errors.length) result.errors.push({ row: row._rowIndex, reason: errors.join(", "), name: buildName(row) || "—" })
    else validRows.push(row)
  }

  const rows = collapseFileDuplicates(validRows, strategy, result)
  const existing = await fetchExistingClients(supabase, clubId, rows)
  const byPhone = new Map(existing.filter((c) => c.phone_normalized).map((c) => [c.phone_normalized!, c]))
  const byEmail = new Map(existing.filter((c) => c.email_normalized).map((c) => [c.email_normalized!, c]))
  const toInsert: ImportClientRow[] = []
  const toUpdate: Array<{ row: ImportClientRow; client: ExistingClient }> = []

  for (const row of rows) {
    const phoneMatch = row.phone ? byPhone.get(normalizeImportPhone(row.phone) ?? "") : undefined
    const emailMatch = row.email ? byEmail.get(normalizeImportEmail(row.email) ?? "") : undefined
    if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
      result.errors.push({ row: row._rowIndex, reason: "Телефон и email принадлежат разным клиентам", name: buildName(row) })
      continue
    }
    const match = phoneMatch ?? emailMatch
    if (!match || strategy === "create") toInsert.push(row)
    else if (strategy === "skip") result.skipped++
    else toUpdate.push({ row, client: match })
  }

  const { count: clientCount } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("club_id", clubId)
  const limitError = requireRecordLimit(club, "clients", clientCount ?? 0, toInsert.length)
  if (limitError) {
    result.errors.push({ row: 0, reason: limitError, name: "" })
    return result
  }

  const allRows = [...toInsert, ...toUpdate.map((item) => item.row)]
  const membershipMap = await resolveMemberships(supabase, clubId, allRows, audit, result)
  const trainerMap = await fetchTrainers(supabase, clubId)
  const insertedPairs = await insertClients(supabase, clubId, toInsert, trainerMap, audit, result)
  const updatedPairs = await updateClients(supabase, clubId, toUpdate, trainerMap, audit, result)

  await createSubscriptions(supabase, clubId, insertedPairs, membershipMap, audit, result)
  await repairSubscriptions(supabase, clubId, updatedPairs, membershipMap, audit, result)
  await importVisits(supabase, clubId, [...insertedPairs, ...updatedPairs], audit, result)

  result.imported = audit.clientsInserted
  result.updated = audit.clientsUpdated
  revalidatePath("/clients")
  revalidatePath("/dashboard")
  return result
}

function denied(result: BatchImportResult) {
  result.errors.push({ row: 0, reason: "Недостаточно прав", name: "" })
  return result
}

function cleanRow(row: ImportClientRow): ImportClientRow {
  const cleaned: ImportClientRow = { _rowIndex: Number(row._rowIndex) || 0 }
  for (const [key, value] of Object.entries(row)) {
    if (key === "_rowIndex" || key === "extra_fields") continue
    if (typeof value === "string") cleaned[key as keyof ImportClientRow] = value.trim() as never
  }
  cleaned.extra_fields = Object.fromEntries(
    Object.entries(row.extra_fields ?? {}).slice(0, 100)
      .map(([key, value]) => [key.trim().slice(0, 120), String(value).trim().slice(0, 2_000)])
      .filter(([key, value]) => key && value),
  )
  return cleaned
}

function validateRow(row: ImportClientRow): string[] {
  const errors: string[] = []
  if (!buildName(row)) errors.push("Нет имени")
  if (row.phone && (normalizeImportPhone(row.phone)?.length ?? 0) < 7) errors.push("Некорректный телефон")
  if (row.email && !normalizeImportEmail(row.email)) errors.push("Некорректный email")
  for (const [value, label] of [[row.birth_date, "дата рождения"], [row.sub_start, "дата начала"], [row.sub_end, "дата окончания"]] as const) {
    if (value && !parseImportDate(value)) errors.push(`Некорректная ${label}`)
  }
  if (row.last_visit && !parseImportDateTime(row.last_visit)) errors.push("Некорректная дата посещения")
  for (const [value, label] of [[row.balance, "баланс"], [row.debt, "долг"]] as const) {
    if (value && parseImportMoney(value) === null) errors.push(`Некорректное поле «${label}»`)
  }
  if (row.visits_total && parseImportInteger(row.visits_total) === null) errors.push("Некорректный остаток посещений")
  return errors
}

function identityKey(row: ImportClientRow): string | null {
  const phone = normalizeImportPhone(row.phone)
  if (phone) return `phone:${phone}`
  const email = normalizeImportEmail(row.email)
  return email ? `email:${email}` : null
}

function collapseFileDuplicates(rows: ImportClientRow[], strategy: DuplicateStrategy, result: BatchImportResult): ImportClientRow[] {
  if (strategy === "create") return rows
  const output: ImportClientRow[] = []
  const positions = new Map<string, number>()
  for (const row of rows) {
    const key = identityKey(row)
    const position = key ? positions.get(key) : undefined
    if (position === undefined) {
      if (key) positions.set(key, output.length)
      output.push(row)
      continue
    }
    if (strategy === "skip") result.skipped++
    else {
      output[position] = mergeRows(output[position], row)
      result.audit.rowsMerged++
    }
  }
  return output
}

function mergeRows(first: ImportClientRow, second: ImportClientRow): ImportClientRow {
  const merged = { ...first }
  for (const [key, value] of Object.entries(second)) {
    if (key === "extra_fields" || key === "_rowIndex") continue
    if (value) (merged as DB)[key] = value
  }
  merged.extra_fields = { ...first.extra_fields, ...second.extra_fields }
  return merged
}

async function fetchExistingClients(supabase: DB, clubId: string, rows: ImportClientRow[]): Promise<ExistingClient[]> {
  const found = new Map<string, ExistingClient>()
  const phones = [...new Set(rows.map((row) => normalizeImportPhone(row.phone)).filter(Boolean))] as string[]
  const emails = [...new Set(rows.map((row) => normalizeImportEmail(row.email)).filter(Boolean))] as string[]
  for (const [column, values] of [["phone_normalized", phones], ["email_normalized", emails]] as const) {
    for (const part of chunks(values, 100)) {
      const { data } = await supabase.from("clients")
        .select("id, phone_normalized, email_normalized, import_data")
        .eq("club_id", clubId).in(column, part)
      for (const client of (data ?? []) as ExistingClient[]) found.set(client.id, client)
    }
  }
  return [...found.values()]
}

async function insertClients(
  supabase: DB,
  clubId: string,
  rows: ImportClientRow[],
  trainerMap: Map<string, string>,
  audit: ImportAudit,
  result: BatchImportResult,
): Promise<ClientPair[]> {
  const records = rows.map((row) => {
    const importKey = randomUUID()
    const record = buildClientPatch(row, trainerMap, audit, true)
    record.club_id = clubId
    record.tags = []
    record.import_data = { ...mergeImportData(null, importData(row)), importKey }
    return { row, importKey, record }
  })
  const pairs: ClientPair[] = []

  async function insertPart(part: typeof records): Promise<void> {
    if (!part.length) return
    const { data, error } = await supabase.from("clients").insert(part.map((item) => item.record)).select("id, import_data")
    if (error) {
      if (part.length > 1) {
        const middle = Math.ceil(part.length / 2)
        await insertPart(part.slice(0, middle)); await insertPart(part.slice(middle))
      } else {
        result.errors.push({ row: part[0].row._rowIndex, reason: error.message, name: buildName(part[0].row) })
      }
      return
    }
    const ids = new Map<string, string>((data ?? []).map((item: DB) => [String(item.import_data?.importKey ?? ""), String(item.id)]))
    for (const item of part) {
      const id = ids.get(item.importKey)
      if (id) { pairs.push({ id, row: item.row }); audit.clientsInserted++ }
      else result.errors.push({ row: item.row._rowIndex, reason: "База не вернула ID созданного клиента", name: buildName(item.row) })
    }
  }

  for (const part of chunks(records, 100)) await insertPart(part)
  return pairs
}

async function updateClients(
  supabase: DB,
  clubId: string,
  items: Array<{ row: ImportClientRow; client: ExistingClient }>,
  trainerMap: Map<string, string>,
  audit: ImportAudit,
  result: BatchImportResult,
): Promise<ClientPair[]> {
  const pairs: ClientPair[] = []
  for (const part of chunks(items, 25)) {
    await Promise.all(part.map(async ({ row, client }) => {
      const patch = buildClientPatch(row, trainerMap, audit, false)
      patch.import_data = mergeImportData(client.import_data, importData(row))
      const { error } = await supabase.from("clients").update(patch).eq("club_id", clubId).eq("id", client.id)
      if (error) result.errors.push({ row: row._rowIndex, reason: error.message, name: buildName(row) })
      else { audit.clientsUpdated++; pairs.push({ id: client.id, row }) }
    }))
  }
  return pairs
}

function buildClientPatch(row: ImportClientRow, trainerMap: Map<string, string>, audit: ImportAudit, insert: boolean): DB {
  const patch: DB = {}
  const set = (key: string, value: unknown, present: boolean) => { if (insert || present) patch[key] = value }
  set("full_name", buildName(row), !!buildName(row))
  set("phone", row.phone || null, !!row.phone)
  set("email", normalizeImportEmail(row.email), !!row.email)
  set("birth_date", parseImportDate(row.birth_date), !!row.birth_date)
  set("gender", normalizeGender(row.gender), !!row.gender)
  set("source", row.source || null, !!row.source)
  set("notes", row.notes || null, !!row.notes)

  const balance = parseImportMoney(row.balance)
  const debt = parseImportMoney(row.debt)
  if (balance !== null || debt !== null) audit.financialsSet++
  set("balance", balance ?? 0, balance !== null)
  set("debt", debt ?? 0, debt !== null)
  if (row.trainer) {
    patch.trainer_name = row.trainer
    const trainerId = trainerMap.get(normalizeLookup(row.trainer))
    if (trainerId) { patch.trainer_id = trainerId; audit.trainersLinked++ }
    else { patch.trainer_id = null; audit.trainersUnmatched++ }
  } else if (insert) {
    patch.trainer_name = null; patch.trainer_id = null
  }
  audit.extraFieldsSaved += Object.keys(row.extra_fields ?? {}).length
  return patch
}

function importData(row: ImportClientRow) {
  return { sourceFile: row.source_file, sourceRow: row._rowIndex + 1, extraFields: row.extra_fields ?? {} }
}

async function fetchTrainers(supabase: DB, clubId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data } = await supabase.from("staff").select("id, users(full_name)").eq("club_id", clubId).eq("is_active", true)
  for (const staff of (data ?? []) as DB[]) {
    const user = Array.isArray(staff.users) ? staff.users[0] : staff.users
    if (user?.full_name) map.set(normalizeLookup(user.full_name), staff.id)
  }
  return map
}

async function resolveMemberships(
  supabase: DB, clubId: string, rows: ImportClientRow[], audit: ImportAudit, result: BatchImportResult,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data } = await supabase.from("memberships").select("id, name").eq("club_id", clubId)
  for (const membership of (data ?? []) as DB[]) map.set(normalizeLookup(membership.name), membership.id)
  const wanted = [...new Map(rows.filter((row) => row.membership_name).map((row) => [normalizeLookup(row.membership_name!), row.membership_name!])).entries()]
  const missing = wanted.filter(([key]) => !map.has(key))
  audit.membershipsMatched += wanted.length - missing.length
  if (!missing.length) return map

  const { data: created, error } = await supabase.from("memberships").insert(missing.map(([, name]) => ({
    club_id: clubId, name, price: 0, duration_days: 30, visits_limit: null, is_active: true,
  }))).select("id, name")
  if (error) {
    result.errors.push({ row: 0, reason: `Не удалось создать импортированные тарифы: ${error.message}`, name: "" })
    return map
  }
  for (const membership of (created ?? []) as DB[]) {
    map.set(normalizeLookup(membership.name), membership.id); audit.membershipsCreated++
  }
  return map
}

async function createSubscriptions(
  supabase: DB, clubId: string, pairs: ClientPair[], memberships: Map<string, string>, audit: ImportAudit, result: BatchImportResult,
) {
  const records = pairs.filter(({ row }) => hasSubscriptionData(row)).map(({ id, row }) => buildNewSubscription(clubId, id, row, memberships))
  for (const part of chunks(records, 100)) {
    const { error } = await supabase.from("subscriptions").insert(part)
    if (error) result.errors.push({ row: 0, reason: `Клиенты сохранены, ошибка абонементов: ${error.message}`, name: "" })
    else audit.subscriptionsCreated += part.length
  }
}

async function repairSubscriptions(
  supabase: DB, clubId: string, pairs: ClientPair[], memberships: Map<string, string>, audit: ImportAudit, result: BatchImportResult,
) {
  const relevant = pairs.filter(({ row }) => hasSubscriptionData(row))
  if (!relevant.length) return
  const { data } = await supabase.from("subscriptions")
    .select("id, client_id, visits_used, created_at").eq("club_id", clubId)
    .in("client_id", relevant.map((pair) => pair.id)).order("created_at", { ascending: false })
  const latest = new Map<string, DB>()
  for (const subscription of (data ?? []) as DB[]) if (!latest.has(subscription.client_id)) latest.set(subscription.client_id, subscription)

  for (const { id, row } of relevant) {
    const current = latest.get(id)
    if (!current) {
      const { error } = await supabase.from("subscriptions").insert(buildNewSubscription(clubId, id, row, memberships))
      if (error) result.errors.push({ row: row._rowIndex, reason: `Клиент обновлён, абонемент не создан: ${error.message}`, name: buildName(row) })
      else audit.subscriptionsCreated++
      continue
    }
    const patch = buildSubscriptionPatch(row, memberships, Number(current.visits_used ?? 0))
    const { error } = await supabase.from("subscriptions").update(patch).eq("club_id", clubId).eq("id", current.id)
    if (error) result.errors.push({ row: row._rowIndex, reason: `Клиент обновлён, абонемент не обновлён: ${error.message}`, name: buildName(row) })
    else audit.subscriptionsUpdated++
  }
}

function buildNewSubscription(clubId: string, clientId: string, row: ImportClientRow, memberships: Map<string, string>): DB {
  const expiresAt = parseImportDate(row.sub_end)
  const remaining = parseImportInteger(row.visits_total)
  return {
    club_id: clubId,
    client_id: clientId,
    membership_id: row.membership_name ? memberships.get(normalizeLookup(row.membership_name)) ?? null : null,
    starts_at: parseImportDate(row.sub_start) ?? new Date().toISOString().slice(0, 10),
    expires_at: expiresAt,
    visits_total: remaining,
    visits_used: 0,
    status: deriveSubStatus(row.sub_status, expiresAt),
  }
}

function buildSubscriptionPatch(row: ImportClientRow, memberships: Map<string, string>, visitsUsed: number): DB {
  const patch: DB = {}
  if (row.membership_name) patch.membership_id = memberships.get(normalizeLookup(row.membership_name)) ?? null
  if (row.sub_start) patch.starts_at = parseImportDate(row.sub_start)
  if (row.sub_end) patch.expires_at = parseImportDate(row.sub_end)
  if (row.visits_total) patch.visits_total = visitsUsed + (parseImportInteger(row.visits_total) ?? 0)
  if (row.sub_status || row.sub_end) patch.status = deriveSubStatus(row.sub_status, parseImportDate(row.sub_end))
  return patch
}

async function importVisits(
  supabase: DB, clubId: string, pairs: ClientPair[], audit: ImportAudit, result: BatchImportResult,
) {
  const wanted = pairs.map(({ id, row }) => ({ id, row, at: parseImportDateTime(row.last_visit) })).filter((item) => item.at)
  if (!wanted.length) return
  const { data } = await supabase.from("visits").select("client_id, checked_in_at").eq("club_id", clubId).in("client_id", wanted.map((item) => item.id))
  const existing = new Set((data ?? []).map((visit: DB) => `${visit.client_id}:${new Date(visit.checked_in_at).toISOString()}`))
  const records = wanted.filter((item) => !existing.has(`${item.id}:${item.at}`)).map((item) => ({
    club_id: clubId, client_id: item.id, checked_in_at: item.at, method: "manual",
  }))
  for (const part of chunks(records, 100)) {
    const { error } = await supabase.from("visits").insert(part)
    if (error) result.errors.push({ row: 0, reason: `Клиенты сохранены, ошибка посещений: ${error.message}`, name: "" })
    else audit.visitsCreated += part.length
  }
}

function hasSubscriptionData(row: ImportClientRow): boolean {
  return !!(row.membership_name || row.sub_status || row.sub_start || row.sub_end || row.visits_total)
}

function buildName(row: ImportClientRow): string {
  return (row.full_name || [row.last_name, row.first_name].filter(Boolean).join(" ")).trim()
}

function normalizeLookup(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim()
}

function normalizeGender(value?: string): "male" | "female" | null {
  const normalized = normalizeLookup(value ?? "")
  if (["м", "m", "male", "мужской", "мужчина", "муж"].includes(normalized)) return "male"
  if (["ж", "f", "female", "женский", "женщина", "жен"].includes(normalized)) return "female"
  return null
}

function deriveSubStatus(value: string | undefined, expiresAt: string | null): "active" | "expired" | "frozen" | "cancelled" {
  const normalized = normalizeLookup(value ?? "")
  if (["просрочен", "expired", "истёк", "истек", "закончился", "истекший"].includes(normalized)) return "expired"
  if (["заморожен", "frozen", "заморожено", "заморозка"].includes(normalized)) return "frozen"
  if (["отменён", "отменен", "cancelled", "canceled"].includes(normalized)) return "cancelled"
  if (expiresAt && expiresAt < new Date().toISOString().slice(0, 10)) return "expired"
  return "active"
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}
