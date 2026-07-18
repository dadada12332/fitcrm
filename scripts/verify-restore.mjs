import { createClient } from "@supabase/supabase-js"

const url = process.env.RESTORE_SUPABASE_URL
const serviceKey = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY

if (process.env.RESTORE_CONFIRM_ISOLATED_TARGET !== "yes") {
  throw new Error("Set RESTORE_CONFIRM_ISOLATED_TARGET=yes only for a disposable restore target")
}
if (!url || !serviceKey) throw new Error("Missing RESTORE_SUPABASE_URL or RESTORE_SUPABASE_SERVICE_ROLE_KEY")
if (process.env.NEXT_PUBLIC_SUPABASE_URL && url === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Refusing to run restore verification against the configured production project")
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const tables = ["clubs", "users", "staff", "clients", "memberships", "subscriptions", "payments", "visits"]
const counts = {}

for (const table of tables) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  counts[table] = count ?? 0
}

const [{ data: buckets, error: bucketError }, { data: authData, error: authError }] = await Promise.all([
  supabase.storage.listBuckets(),
  supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
])
if (bucketError) throw new Error(`storage buckets: ${bucketError.message}`)
if (authError) throw new Error(`auth users: ${authError.message}`)

const result = {
  checkedAt: new Date().toISOString(),
  target: new URL(url).hostname,
  tables: counts,
  authUsers: authData.total ?? null,
  storageBuckets: buckets?.length ?? 0,
}

console.log(JSON.stringify(result, null, 2))
