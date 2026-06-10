import { createClient } from "@/lib/supabase/server"

export type CurrentClub = { clubId: string; role: string; clubName: string } | null

/** Returns the current user's club membership (first one) or null if none. */
export async function getCurrentClub(): Promise<CurrentClub> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("staff")
    .select("club_id, role, clubs(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const club = data.clubs as unknown as { name: string } | null
  return { clubId: data.club_id, role: data.role, clubName: club?.name ?? "Клуб" }
}
