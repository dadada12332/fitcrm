import { cache } from "react"
import { createClient } from "./supabase/server"

// getUser() validates JWT with Supabase Auth (~150ms). Per-request cache via React.cache().
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
