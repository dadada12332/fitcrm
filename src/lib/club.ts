import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export type CurrentClub = { clubId: string; role: string; clubName: string; plan: string } | null

export const getCurrentClub = cache(async (userId?: string): Promise<CurrentClub> => {
  const supabase = await createClient()

  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    uid = user.id
  }

  const cookieStore = await cookies()
  const selectedClubId = cookieStore.get("selected_club_id")?.value

  let query = supabase
    .from("staff")
    .select("club_id, role, clubs(name, plan)")
    .eq("user_id", uid)
    .eq("is_active", true)

  if (selectedClubId) query = query.eq("club_id", selectedClubId)

  const { data } = await query.limit(1).maybeSingle()

  if (!data) {
    // fallback: selected club no longer valid, return first available
    const { data: fallback } = await supabase
      .from("staff")
      .select("club_id, role, clubs(name, plan)")
      .eq("user_id", uid)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (!fallback) return null
    const fb = fallback.clubs as unknown as { name: string; plan: string } | null
    return { clubId: fallback.club_id, role: fallback.role, clubName: fb?.name ?? "Клуб", plan: fb?.plan ?? "" }
  }

  const club = data.clubs as unknown as { name: string; plan: string } | null
  return { clubId: data.club_id, role: data.role, clubName: club?.name ?? "Клуб", plan: club?.plan ?? "" }
})
