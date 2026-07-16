"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getClientsForExport, type ClientsQuery, type ClientRow } from "@/lib/clients"

export type ClientFormState = { error?: string; ok?: boolean }

function clientsToCSV(rows: ClientRow[]): string {
  const header = ["Имя", "Телефон", "Дата рожд.", "Пол", "Абонемент", "Источник", "Статус"]
  const line = (r: ClientRow) => [
    r.name,
    r.phone ?? "",
    r.birthDate ?? "",
    r.gender === "male" ? "Мужской" : r.gender === "female" ? "Женский" : "",
    r.membership ?? "",
    r.source ?? "",
    r.status === "active" ? "Активный" : r.status === "frozen" ? "Заморожен" : r.status === "expired" ? "Истёк" : "Нет",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
  return [header.join(","), ...rows.map(line)].join("\r\n")
}

/** Экспорт ВСЕХ клиентов с учётом текущих фильтров (не только текущей страницы). */
export async function exportClientsCsvAction(q: ClientsQuery): Promise<{ csv?: string; error?: string }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!club.permissions.clients.view) return { error: "Нет прав" }
  const rows = await getClientsForExport(supabase, club.clubId, q)
  return { csv: clientsToCSV(rows) }
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const firstName  = String(formData.get("first_name") ?? "").trim()
  const lastName   = String(formData.get("last_name") ?? "").trim()
  const phone      = String(formData.get("phone") ?? "").trim()
  const birthDate  = String(formData.get("birth_date") ?? "").trim()
  const gender     = String(formData.get("gender") ?? "").trim()
  const email      = String(formData.get("email") ?? "").trim()
  const membershipId = String(formData.get("membership_id") ?? "").trim()
  const trainerId  = String(formData.get("trainer_id") ?? "").trim()
  const trainerName = String(formData.get("trainer_name") ?? "").trim()
  const source     = String(formData.get("source") ?? "").trim()
  const notes      = String(formData.get("notes") ?? "").trim()

  if (!firstName) return { error: "Введите имя клиента" }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const supabase = await createClient()

  const { data: newClient, error: clientErr } = await supabase
    .from("clients")
    .insert({
      club_id: club.clubId,
      full_name: lastName ? `${firstName} ${lastName}` : firstName,
      phone: phone || null,
      gender: gender || null,
      birth_date: birthDate || null,
      email: email || null,
      source: source || null,
      notes: notes || null,
      trainer_id: trainerId || null,
      trainer_name: trainerName || null,
      tags: [],
    })
    .select("id")
    .single()

  if (clientErr) return { error: clientErr.message }

  const clientId = newClient.id as string

  if (membershipId) {
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]

    if (membershipId === "single") {
      const tomorrow = new Date(today.getTime() + 86_400_000)
      await supabase.from("subscriptions").insert({
        club_id: club.clubId,
        client_id: clientId,
        membership_id: null,
        visits_total: 1,
        visits_used: 0,
        starts_at: todayStr,
        expires_at: tomorrow.toISOString().split("T")[0],
        status: "active",
      })
    } else {
      const { data: mem } = await supabase
        .from("memberships")
        .select("duration_days, visits_limit")
        .eq("id", membershipId)
        .single()

      if (mem) {
        const expires = new Date(today.getTime() + (mem.duration_days as number) * 86_400_000)
        await supabase.from("subscriptions").insert({
          club_id: club.clubId,
          client_id: clientId,
          membership_id: membershipId,
          visits_total: (mem.visits_limit as number | null) ?? null,
          visits_used: 0,
          starts_at: todayStr,
          expires_at: expires.toISOString().split("T")[0],
          status: "active",
        })
      }
    }
  }

  revalidatePath("/clients")
  return { ok: true }
}

export type ImportClientRow = {
  full_name: string
  phone?: string
  email?: string
  notes?: string
  gender?: string
}

export async function importClientsAction(
  rows: ImportClientRow[],
): Promise<{ error?: string; ok?: boolean; imported?: number }> {
  if (!rows.length) return { error: "Нет данных для импорта" }

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }

  const supabase = await createClient()

  const records = rows.map((r) => ({
    club_id: club.clubId,
    full_name: r.full_name.trim(),
    phone: r.phone?.trim() || null,
    email: r.email?.trim() || null,
    notes: r.notes?.trim() || null,
    gender: r.gender?.trim() || null,
    tags: [],
  }))

  const { error } = await supabase.from("clients").insert(records)
  if (error) return { error: error.message }

  revalidatePath("/clients")
  return { ok: true, imported: records.length }
}

export async function deleteClientAction(clientId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!(["owner", "admin"].includes(club.role) || club.permissions.clients.delete)) return { error: "Недостаточно прав" }

  // Отвязываем оплаты клиента: payments.client_id / subscription_id не имеют
  // ON DELETE CASCADE, поэтому без этого FK блокирует удаление (клиент оставался
  // в базе, а UI ошибочно рапортовал успех). Финансовую историю сохраняем — просто
  // снимаем привязку к удаляемому клиенту и его абонементам.
  await supabase
    .from("payments")
    .update({ client_id: null, subscription_id: null })
    .eq("client_id", clientId)
    .eq("club_id", club.clubId)

  // subscriptions и visits удалятся каскадом (ON DELETE CASCADE по client_id).
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/clients")
  return { ok: true }
}

export async function updateClientAction(
  clientId: string,
  fields: {
    full_name: string
    phone?: string | null
    email?: string | null
    birth_date?: string | null
    gender?: string | null
    source?: string | null
    notes?: string | null
    balance?: number | null
    debt?: number | null
    trainer_name?: string | null
  },
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }

  const payload: Record<string, unknown> = {
    full_name: fields.full_name,
    phone: fields.phone || null,
    email: fields.email || null,
    birth_date: fields.birth_date || null,
    gender: fields.gender || null,
    source: fields.source || null,
    notes: fields.notes || null,
  }

  // Apply financial/trainer columns only if they exist in schema
  if (fields.balance != null) payload.balance = fields.balance
  if (fields.debt != null) payload.debt = fields.debt
  if (fields.trainer_name !== undefined) payload.trainer_name = fields.trainer_name || null

  const { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("club_id", club.clubId)

  if (error) return { error: error.message }

  revalidatePath("/clients")
  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}

export async function toggleFreezeAction(clientId: string, currentStatus: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()

  const targetStatus = currentStatus === "frozen" ? "active" : "frozen"
  const fromStatus = currentStatus === "frozen" ? "frozen" : "active"

  const { data: subs, error: subErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", fromStatus)
    .order("created_at", { ascending: false })
    .limit(1)

  if (subErr) return { error: subErr.message }
  if (!subs?.length) return { error: "Активный абонемент не найден" }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: targetStatus })
    .eq("id", subs[0].id)

  if (error) return { error: error.message }

  revalidatePath("/clients")
  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}

/**
 * Продление / смена абонемента клиента.
 * Если у клиента есть активный абонемент того же типа — продлеваем (срок += длительность,
 * визиты складываются). Иначе — «смена»: гасим прочие активные (один активный на клиента) и
 * оформляем новый.
 */
export async function renewSubscriptionAction(
  clientId: string, membershipId: string,
): Promise<{ ok?: boolean; error?: string; mode?: "extend" | "replace" }> {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!membershipId) return { error: "Выберите абонемент" }
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  let durationDays = 30
  let visitsLimit: number | null = null
  const isSingle = membershipId === "single"
  if (!isSingle) {
    const { data: m } = await supabase.from("memberships")
      .select("duration_days, visits_limit").eq("id", membershipId).eq("club_id", club.clubId).maybeSingle()
    if (!m) return { error: "Абонемент не найден" }
    durationDays = Number(m.duration_days) || 30
    visitsLimit = (m.visits_limit as number | null) ?? null
  } else { durationDays = 1; visitsLimit = 1 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: any = null
  if (!isSingle) {
    const { data } = await supabase.from("subscriptions")
      .select("id, expires_at, visits_total, visits_used")
      .eq("client_id", clientId).eq("club_id", club.clubId).eq("membership_id", membershipId).eq("status", "active")
      .order("expires_at", { ascending: false }).limit(1).maybeSingle()
    existing = data
  }

  if (existing) {
    const base = existing.expires_at && existing.expires_at > todayStr ? new Date(existing.expires_at) : today
    const newExpires = new Date(base.getTime() + durationDays * 86_400_000).toISOString().slice(0, 10)
    const newTotal = existing.visits_total !== null && visitsLimit !== null
      ? Number(existing.visits_total) + visitsLimit
      : (visitsLimit ?? existing.visits_total)
    const { error } = await supabase.from("subscriptions")
      .update({ expires_at: newExpires, visits_total: newTotal, status: "active" }).eq("id", existing.id)
    if (error) return { error: error.message }
    revalidatePath(`/clients/${clientId}`); revalidatePath("/clients")
    return { ok: true, mode: "extend" }
  }

  await supabase.from("subscriptions").update({ status: "expired" })
    .eq("client_id", clientId).eq("club_id", club.clubId).eq("status", "active")
  const expires = new Date(today.getTime() + durationDays * 86_400_000).toISOString().slice(0, 10)
  const { error } = await supabase.from("subscriptions").insert({
    club_id: club.clubId, client_id: clientId, membership_id: isSingle ? null : membershipId,
    visits_total: visitsLimit, visits_used: 0, starts_at: todayStr, expires_at: expires, status: "active",
  })
  if (error) return { error: error.message }
  revalidatePath(`/clients/${clientId}`); revalidatePath("/clients")
  return { ok: true, mode: "replace" }
}
