import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8")

describe("service-role payment tenant scopes", () => {
  it("scopes Click payment mutations to the callback club", () => {
    const source = read("src/app/api/pay/click/[clubId]/route.ts")

    expect(source.match(/from\("payments"\)\.update\(/g)).toHaveLength(2)
    expect(source.match(/\.eq\("club_id", clubId\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("scopes every Payme transaction lookup and mutation to the callback club", () => {
    const source = read("src/app/api/pay/payme/[clubId]/route.ts")
    const lines = source.split("\n")
    const transactionQueries = lines
      .map((line, index) => line.includes('from("payme_transactions")') ? lines.slice(index, index + 5).join("\n") : null)
      .filter((query): query is string => query !== null)

    expect(transactionQueries).toHaveLength(9)
    for (const query of transactionQueries) expect(query).toContain('"club_id", clubId')
  })

  it("keeps post-payment reads and mutations inside the payment club", () => {
    const source = read("src/lib/payment-confirm.ts")

    expect(source).toContain('.eq("id", pay.pending_membership_id).eq("club_id", clubId)')
    expect(source).toContain('.eq("id", pay.subscription_id).eq("club_id", clubId)')
    expect(source).toContain('.eq("id", clientId).eq("club_id", clubId)')
    expect(source.match(/\.eq\("id", paymentId\)\.eq\("club_id", clubId\)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("scopes scheduled broadcast mutations to the queued club", () => {
    const source = read("src/app/api/broadcasts/run/route.ts")

    expect(source.match(/\.eq\("id", b\.id\)\.eq\("club_id", b\.club_id\)/g)).toHaveLength(2)
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
