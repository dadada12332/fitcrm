import { describe, expect, it } from "vitest"
import type { RetentionData } from "../../src/lib/retention"
import { buildRetentionAiAnalysis, matchesRetentionFilter } from "../../src/lib/retention-ai"

const DATA: RetentionData = {
  summary: { atRisk: 2, critical: 1, inactive14: 1, expiring7: 1, revenueAtRisk: 800_000 },
  candidates: [
    {
      id: "critical-client",
      name: "Камила Тестова",
      phone: null,
      membership: "Бизнес",
      source: null,
      status: "active",
      daysLeft: 2,
      lastVisit: "2026-06-01T10:00:00.000Z",
      inactiveDays: 49,
      debt: 100_000,
      score: 100,
      level: "critical",
      reasons: ["expiring", "inactive", "debt"],
      estimatedValue: 500_000,
      recommendedAction: "Уточнить оплату",
    },
    {
      id: "expired-client",
      name: "Алина Тестова",
      phone: null,
      membership: "Стандарт",
      source: null,
      status: "expired",
      daysLeft: null,
      lastVisit: "2026-06-20T10:00:00.000Z",
      inactiveDays: 30,
      debt: 0,
      score: 45,
      level: "high",
      reasons: ["expired"],
      estimatedValue: 300_000,
      recommendedAction: "Предложить возвращение",
    },
  ],
}

describe("retention AI analysis", () => {
  it("keeps the active retention filter in the portfolio analysis", () => {
    const result = buildRetentionAiAnalysis(DATA, { kind: "portfolio", filter: "expired" })

    expect(result?.metrics.selected).toBe(1)
    expect(result?.priorities[0].clientId).toBe("expired-client")
    expect(result?.scope).toEqual({ kind: "portfolio", filter: "expired" })
  })

  it("builds a client-scoped recommendation without exposing risk language in the draft", () => {
    const result = buildRetentionAiAnalysis(DATA, { kind: "client", clientId: "critical-client" }, {
      "critical-client": { visits30: 1, previousVisits30: 5, paid180: 500_000, lastPaymentAt: null, subscriptionsCount: 2 },
    })

    expect(result?.priorities).toHaveLength(1)
    expect(result?.priorities[0].facts).toContain("Визиты 30 дней: 1")
    expect(result?.priorities[0].rationale).toContain("80%")
    expect(result?.priorities[0].messageDraft.toLowerCase()).not.toContain("риск")
    expect(result?.confidence).toBe("high")
  })

  it("rejects a client outside the retention queue", () => {
    expect(buildRetentionAiAnalysis(DATA, { kind: "client", clientId: "unknown" })).toBeNull()
  })

  it("matches both risk levels and reason filters", () => {
    const candidate = DATA.candidates[0]
    expect(matchesRetentionFilter(candidate, "critical")).toBe(true)
    expect(matchesRetentionFilter(candidate, "debt")).toBe(true)
    expect(matchesRetentionFilter(candidate, "expired")).toBe(false)
  })
})
