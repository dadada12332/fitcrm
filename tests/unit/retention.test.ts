import { describe, expect, it } from "vitest"
import type { ClientRow } from "../../src/lib/clients"
import { buildRetentionData } from "../../src/lib/retention"

const NOW = new Date("2026-07-19T12:00:00+05:00")

function client(overrides: Partial<ClientRow>): ClientRow {
  return {
    id: "client-1",
    name: "Тестовый клиент",
    phone: null,
    birthDate: null,
    gender: null,
    source: null,
    membership: "Стандарт",
    expiresAt: "2026-08-19",
    daysLeft: 31,
    visitsLeft: 8,
    lastVisit: "2026-07-18T10:00:00+05:00",
    debt: 0,
    status: "active",
    ...overrides,
  }
}

describe("retention scoring", () => {
  it("keeps healthy active clients out of the queue", () => {
    const result = buildRetentionData([client({})], { Стандарт: 500_000 }, NOW)
    expect(result.candidates).toHaveLength(0)
    expect(result.summary.atRisk).toBe(0)
  })

  it("prioritizes a client with several simultaneous risk signals", () => {
    const row = client({ daysLeft: 2, expiresAt: "2026-07-21", lastVisit: "2026-06-01T10:00:00+05:00", debt: 150_000 })
    const result = buildRetentionData([row], { Стандарт: 500_000 }, NOW)
    const candidate = result.candidates[0]

    expect(candidate.level).toBe("critical")
    expect(candidate.score).toBe(100)
    expect(candidate.reasons).toEqual(["expiring", "inactive", "debt"])
    expect(result.summary.revenueAtRisk).toBe(500_000)
  })

  it("includes recently expired clients as win-back opportunities", () => {
    const row = client({ status: "expired", daysLeft: null, expiresAt: "2026-07-01", lastVisit: "2026-06-25T10:00:00+05:00" })
    const result = buildRetentionData([row], { Стандарт: 500_000 }, NOW)

    expect(result.candidates[0].reasons).toContain("expired")
    expect(result.candidates[0].recommendedAction).toContain("возвращение")
  })

  it("sorts higher risks before medium risks", () => {
    const high = client({ id: "high", daysLeft: 1, debt: 100_000 })
    const medium = client({ id: "medium", status: "frozen", daysLeft: null })
    const result = buildRetentionData([medium, high], { Стандарт: 500_000 }, NOW)

    expect(result.candidates.map((item) => item.id)).toEqual(["high", "medium"])
  })
})
