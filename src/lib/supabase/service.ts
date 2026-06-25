import { createClient } from "@supabase/supabase-js"

/** Service-role Supabase client — bypasses RLS. Use only in server-side bot/cron code. */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
