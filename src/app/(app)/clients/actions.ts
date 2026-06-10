"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type ClientFormState = { error?: string; ok?: boolean }

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()
  const tagsRaw = String(formData.get("tags") ?? "").trim()

  if (!fullName) {
    return { error: "Введите ФИО клиента" }
  }

  const club = await getCurrentClub()
  if (!club) {
    return { error: "Клуб не найден" }
  }

  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : []

  const supabase = await createClient()
  const { error } = await supabase.from("clients").insert({
    club_id: club.clubId,
    full_name: fullName,
    phone: phone || null,
    notes: notes || null,
    tags,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/clients")
  return { ok: true }
}
