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
})
