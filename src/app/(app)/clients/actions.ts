"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type ClientFormState = { error?: string; ok?: boolean }

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
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/clients")
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
