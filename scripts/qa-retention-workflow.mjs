import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error("Supabase environment is required")

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function cleanup(userId, clubId) {
  if (clubId) assert(await supabase.from("clubs").delete().eq("id", clubId), "delete club")
  if (userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error && !error.message.toLowerCase().includes("not found")) throw error
  }
}

async function setup() {
  const nonce = `${Date.now()}-${randomBytes(3).toString("hex")}`
  const email = `retention-qa-${nonce}@example.com`
  const password = `Qa-${randomBytes(12).toString("base64url")}9!`
  let userId = null
  let clubId = null

  try {
    const auth = assert(await supabase.auth.admin.createUser({ email, password, email_confirm: true }), "create auth user")
    userId = auth.user.id
    assert(await supabase.from("users").upsert({ id: userId, email, full_name: "Codex Retention QA" }), "create user profile")

    const club = assert(await supabase.from("clubs").insert({
      name: `Retention QA ${nonce}`,
      city: "Tashkent",
      owner_id: userId,
      plan: "trial",
      trial_expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    }).select("id").single(), "create club")
    clubId = club.id

    assert(await supabase.from("staff").insert({ user_id: userId, club_id: clubId, role: "owner", is_active: true }), "create staff")
    const membership = assert(await supabase.from("memberships").insert({
      club_id: clubId,
      name: "QA Месяц",
      price: 350000,
      duration_days: 30,
    }).select("id").single(), "create membership")
    const client = assert(await supabase.from("clients").insert({
      club_id: clubId,
      full_name: "Камила Тестова",
      phone: "+998900000001",
      source: "qa",
    }).select("id").single(), "create client")
    const expiresAt = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    assert(await supabase.from("subscriptions").insert({
      club_id: clubId,
      client_id: client.id,
      membership_id: membership.id,
      starts_at: new Date().toISOString().slice(0, 10),
      expires_at: expiresAt,
      status: "active",
      visits_total: 12,
    }), "create subscription")

    process.stdout.write(`${JSON.stringify({ email, password, userId, clubId, clientId: client.id })}\n`)
  } catch (error) {
    await cleanup(userId, clubId)
    throw error
  }
}

const [command, userId, clubId] = process.argv.slice(2)
if (command === "setup") await setup()
else if (command === "cleanup") await cleanup(userId, clubId)
else throw new Error("Use setup or cleanup <userId> <clubId>")
