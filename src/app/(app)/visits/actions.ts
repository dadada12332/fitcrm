"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"

export type MarkVisitResult = {
  ok?: boolean
  error?: string
  warning?: string
}

export async function markVisitAction(
  clientId: string,
  subscriptionId: string | null
): Promise<MarkVisitResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase
    .from("staff")
    .select("club_id")
    .eq("user_id", user.id)
    .single()

  if (!staff?.club_id) return { error: "Клуб не найден" }

  let warning: string | undefined

  if (subscriptionId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, visits_total, visits_used")
      .eq("id", subscriptionId)
      .single()

    if (sub?.status === "expired") {
      return { error: "Абонемент истёк — сначала продлите" }
    }
    if (sub?.visits_total !== null && sub !== null && sub.visits_used >= sub.visits_total) {
      return { error: "Исчерпан лимит посещений" }
    }
    if (sub?.visits_total !== null && sub !== null && sub.visits_total - sub.visits_used <= 3) {
      warning = `Осталось ${sub.visits_total - sub.visits_used} посещений`
    }

    await supabase
      .from("subscriptions")
      .update({ visits_used: (sub?.visits_used ?? 0) + 1 })
      .eq("id", subscriptionId)
  }

  const { error } = await supabase.from("visits").insert({
    club_id: staff.club_id,
    client_id: clientId,
    subscription_id: subscriptionId ?? null,
    method: "manual",
  })

  if (error) return { error: error.message }

  revalidatePath("/visits")
  return { ok: true, warning }
}

export async function searchClientsAction(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return []
  return searchClientsForCheckin(supabase, query, club.clubId)
}
