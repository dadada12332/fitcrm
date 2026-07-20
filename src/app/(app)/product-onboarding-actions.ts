"use server"

import { getAuthUser } from "@/lib/auth"
import { getCurrentClub } from "@/lib/club"
import { can } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

type Result = { ok?: true; error?: string }

async function updateOwnStaff(values: Record<string, string>): Promise<Result> {
  const [club, user] = await Promise.all([getCurrentClub(), getAuthUser()])
  if (!club || !user) return { error: "Не авторизован" }
  if (club.role !== "owner" || !can(club.permissions, "dashboard", "view")) {
    return { error: "Недостаточно прав" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff")
    .update(values)
    .eq("club_id", club.clubId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .select("id")
    .maybeSingle()

  if (error || !data) return { error: "Не удалось сохранить настройку" }
  return { ok: true }
}

export async function completeProductTourAction(): Promise<Result> {
  return updateOwnStaff({ product_tour_completed_at: new Date().toISOString() })
}

export async function markTrialOfferSeenAction(): Promise<Result> {
  const club = await getCurrentClub()
  if (!club || club.plan !== "trial" || !can(club.permissions, "settings", "subscription")) {
    return { error: "Предложение недоступно" }
  }
  return updateOwnStaff({ trial_offer_last_seen_at: new Date().toISOString() })
}
