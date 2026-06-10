import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export type CurrentClub = { clubId: string; role: string; clubName: string } | null

/** Returns the current user's club membership (first one) or null if none.
 *  Pass `userId` if you already have it to avoid a redundant auth round-trip.
 *  Wrapped in React cache() so repeat calls within one render are deduped. */
export const getCurrentClub = cache(async (userId?: string): Promise<CurrentClub> => {
  const supabase = await createClient()

  let uid = userId
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    uid = user.id
  }

  const { data } = await supabase
    .from("staff")
    .select("club_id, role, clubs(name)")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const club = data.clubs as unknown as { name: string } | null
  return { clubId: data.club_id, role: data.role, clubName: club?.name ?? "Клуб" }
})
