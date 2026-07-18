import { createClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"

const required = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_CLUB_A_EMAIL",
  "E2E_CLUB_A_PASSWORD",
  "E2E_CLUB_A_ID",
  "E2E_CLUB_B_EMAIL",
  "E2E_CLUB_B_PASSWORD",
  "E2E_CLUB_B_ID",
] as const

const hasIsolatedDatabase = process.env.E2E_ALLOW_REMOTE_TEST_DATABASE === "true"
  && required.every((key) => Boolean(process.env[key]))

describe.skipIf(!hasIsolatedDatabase)("tenant isolation against an isolated Supabase database", () => {
  it("prevents two authenticated clubs from reading or inserting into each other's tenant", async () => {
    const url = process.env.E2E_SUPABASE_URL!
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY!
    const clubA = createClient(url, anonKey)
    const clubB = createClient(url, anonKey)

    const [authA, authB] = await Promise.all([
      clubA.auth.signInWithPassword({ email: process.env.E2E_CLUB_A_EMAIL!, password: process.env.E2E_CLUB_A_PASSWORD! }),
      clubB.auth.signInWithPassword({ email: process.env.E2E_CLUB_B_EMAIL!, password: process.env.E2E_CLUB_B_PASSWORD! }),
    ])
    expect(authA.error).toBeNull()
    expect(authB.error).toBeNull()

    const [aReadsB, bReadsA] = await Promise.all([
      clubA.from("clients").select("id").eq("club_id", process.env.E2E_CLUB_B_ID!).limit(1),
      clubB.from("clients").select("id").eq("club_id", process.env.E2E_CLUB_A_ID!).limit(1),
    ])
    expect(aReadsB.error).toBeNull()
    expect(bReadsA.error).toBeNull()
    expect(aReadsB.data).toEqual([])
    expect(bReadsA.data).toEqual([])

    const forbiddenInsert = await clubA.from("clients").insert({
      club_id: process.env.E2E_CLUB_B_ID!,
      full_name: "E2E tenant boundary probe",
    })
    expect(forbiddenInsert.error, "cross-tenant insert must be rejected by RLS").not.toBeNull()

    await Promise.all([clubA.auth.signOut(), clubB.auth.signOut()])
  })
})
