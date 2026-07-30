import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migrationsDir = path.join(process.cwd(), "supabase/migrations")
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort()
const sql = migrationFiles.map((file) => readFileSync(path.join(migrationsDir, file), "utf8")).join("\n").toLowerCase()

describe("database security migrations", () => {
  it("keeps migration numbering unique", () => {
    const numbers = migrationFiles.map((file) => file.split("_", 1)[0])
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it.each(["clubs", "staff", "clients", "memberships", "subscriptions", "payments", "visits"])(
    "enables RLS for %s",
    (table) => {
      expect(sql).toMatch(new RegExp("alter\\s+table(?:\\s+public\\.)?" + table + "\\s+enable\\s+row\\s+level\\s+security"))
    },
  )

  it.each([
    "access_control_integrations",
    "access_control_credentials",
    "access_control_events",
    "access_control_reservations",
  ])(
    "keeps access-control table %s behind RLS and service-role access",
    (table) => {
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`))
      expect(sql).toContain("to service_role")
    },
  )

  it("keeps the atomic access-control check-in RPC service-only", () => {
    expect(sql).toContain("reserve_access_control_entry")
    expect(sql).toContain("process_access_control_entry")
    expect(sql).toContain("from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.reserve_access_control_entry")
    expect(sql).toContain("grant execute on function public.process_access_control_entry")
  })

  it("contains the staff privilege-escalation trigger", () => {
    expect(sql).toContain("enforce_staff_no_escalation")
    expect(sql).toContain("create trigger staff_no_escalation")
  })

  it("scopes the tenant helper to the authenticated user", () => {
    expect(sql).toContain("auth.uid()")
    expect(sql).toContain("user_club_ids")
  })

  it("protects platform roles and club billing fields from direct Data API updates", () => {
    expect(sql).toContain("users_protect_platform_role")
    expect(sql).toContain("platform_role_service_only")
    expect(sql).toContain("drop policy if exists users_self_delete")
    expect(sql).toContain("clubs_protect_platform_fields")
    expect(sql).toContain("club_platform_fields_service_only")
  })

  it("keeps provider confirmation and Payme lifecycle RPCs service-only", () => {
    for (const rpc of [
      "confirm_provider_payment",
      "create_payme_transaction",
      "perform_payme_transaction",
      "cancel_payme_transaction",
    ]) {
      expect(sql).toContain(rpc)
      expect(sql).toContain("to service_role")
    }
  })

  it("revokes anonymous execution and runs tenant readers as invoker", () => {
    expect(sql).toContain("0055: prevent public and cross-tenant execution")
    expect(sql).toContain("alter function public.clients_page")
    expect(sql).toContain("security invoker")
    expect(sql).toContain("from public, anon")
    expect(sql).toContain("platform_clubs_metrics(uuid[]) from public, anon, authenticated")
  })
})
