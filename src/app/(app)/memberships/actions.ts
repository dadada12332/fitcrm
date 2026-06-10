"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type MembershipFormState = { error?: string; ok?: boolean }

export async function createMembershipAction(
  _prev: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  const name = String(formData.get("name") ?? "").trim()
  const price = Number(formData.get("price") ?? 0)
  const durationDays = Number(formData.get("duration_days") ?? 0)
  const visitsRaw = String(formData.get("visits_limit") ?? "").trim()

  if (!name) {
    return { error: "Введите название абонемента" }
  }
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Некорректная цена" }
  }
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return { error: "Некорректный срок (дней)" }
  }

  const club = await getCurrentClub()
  if (!club) {
    return { error: "Клуб не найден" }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("memberships").insert({
    club_id: club.clubId,
    name,
    price,
    duration_days: durationDays,
    visits_limit: visitsRaw ? Number(visitsRaw) : null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/memberships")
  return { ok: true }
}
