import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8")

describe("service-role payment tenant scopes", () => {
  it("keeps restricted staff settings out of the authenticated club query", () => {
    const source = read("src/lib/club.ts")
    const membershipQuery = source.slice(
      source.indexOf("let query = supabase"),
      source.indexOf("type ClubRow"),
    )
    const localeQuery = source.slice(
      source.indexOf("async function resolveStaffSettings"),
      source.indexOf("async function resolvePermissions"),
    )

    expect(membershipQuery).not.toContain("club_id, role, settings")
    expect(localeQuery).toContain("createServiceClient()")
    expect(localeQuery).toContain('.eq("user_id", userId)')
    expect(localeQuery).toContain('.eq("club_id", clubId)')
    expect(localeQuery).toContain('.eq("is_active", true)')
  })

  it("scopes Click payment mutations to the callback club", () => {
    const source = read("src/app/api/pay/click/[clubId]/route.ts")
    const migration = read("supabase/migrations/20260730100035_audit_security_billing_payment_hardening.sql")

    expect(source).toContain("confirmProviderPayment(")
    expect(source.match(/\.eq\("club_id", clubId\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration).toContain("where id = p_payment_id")
    expect(migration).toContain("and club_id = p_club_id")
    expect(migration).toContain("for update")
  })

  it("scopes every Payme transaction lookup and mutation to the callback club", () => {
    const source = read("src/app/api/pay/payme/[clubId]/route.ts")
    const lines = source.split("\n")
    const transactionQueries = lines
      .map((line, index) => line.includes('from("payme_transactions")') ? lines.slice(index, index + 5).join("\n") : null)
      .filter((query): query is string => query !== null)

    expect(transactionQueries.length).toBeGreaterThanOrEqual(5)
    for (const query of transactionQueries) expect(query).toContain('"club_id", clubId')
    expect(source).toContain('service.rpc("create_payme_transaction"')
    expect(source).toContain('service.rpc("perform_payme_transaction"')
    expect(source).toContain('service.rpc("cancel_payme_transaction"')
  })

  it("keeps post-payment reads and mutations inside the payment club", () => {
    const source = read("src/lib/payment-confirm.ts")
    const migrations = read("supabase/migrations/20260730100035_audit_security_billing_payment_hardening.sql")

    expect(source).toContain('service.rpc("confirm_provider_payment"')
    expect(source).toContain("p_club_id: clubId")
    expect(migrations).toContain("from public, anon, authenticated")
    expect(migrations).toContain("to service_role")
    expect(source).toContain('.eq("id", clientId).eq("club_id", clubId)')
    expect(source).toContain('.eq("id", paymentId)')
    expect(source).toContain('.eq("club_id", clubId)')
    expect(migrations).toContain("private.confirm_paid_membership(p_club_id, p_payment_id)")
  })

  it("scopes scheduled broadcast mutations to the queued club", () => {
    const source = read("src/app/api/broadcasts/run/route.ts")

    expect(source.match(/\.eq\("id", b\.id\)\.eq\("club_id", b\.club_id\)/g)).toHaveLength(3)
  })

  it("validates Telegram visit clients against the staff club", () => {
    const source = read("src/lib/telegram/bot.ts")
    const visitFlow = source.slice(source.indexOf('if (data.startsWith("do_visit:"))'), source.indexOf('if (data === "today_schedule"'))

    expect(visitFlow).toContain('.eq("id", clientId).eq("club_id", clubId)')
    expect(visitFlow).toContain('.eq("client_id", clientId).eq("club_id", clubId)')
    expect(visitFlow).toContain('if (!client)')
    expect(visitFlow).toContain('.eq("club_id", clubId)')
  })

  it("tracks Mini App visits by the linked CRM client ID, never by display names", () => {
    const miniApp = read("src/app/api/telegram/miniapp/[clubId]/route.ts")
    const qrCheckIn = read("src/app/(app)/visits/actions.ts")
    const bot = read("src/lib/telegram/bot.ts")

    expect(miniApp).toContain('.eq("id", link.client_id).eq("club_id", clubId)')
    expect(miniApp).toContain("createQrPass(clubId, clientId)")
    expect(qrCheckIn).toContain('.eq("id", pass.clientId)')
    expect(qrCheckIn).toContain("client_id: client.id")
    expect(bot).toContain('.eq("phone_normalized", normalized)')
    expect(bot).not.toContain('.ilike("phone", `%${normalized}%`)')
  })
})
