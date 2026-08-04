import { describe, expect, it } from "vitest"
import { resolveAuthoritativeClubSubscription } from "../../src/lib/platform-subscription-server"

const NOW = Date.UTC(2026, 7, 4, 10)

describe("authoritative service-side subscription guard", () => {
  it("treats a custom paid relation as paid even when the legacy enum is trial", () => {
    const state = resolveAuthoritativeClubSubscription({
      plan: "trial",
      status: "active",
      trial_expires_at: "2026-01-01T00:00:00.000Z",
      plan_expires_at: "2026-09-01T00:00:00.000Z",
      plans: { code: "custom_pro", is_trial: false },
    }, NOW)

    expect(state.planCode).toBe("custom_pro")
    expect(state.kind).toBe("active")
    expect(state.isLocked).toBe(false)
  })

  it("fails closed for expired, suspended, and missing-status clubs", () => {
    for (const row of [
      { status: "active", plan_expires_at: "2026-08-03T10:00:00.000Z" },
      { status: "suspended", plan_expires_at: "2026-09-01T10:00:00.000Z" },
      { status: null, plan_expires_at: "2026-09-01T10:00:00.000Z" },
    ]) {
      const state = resolveAuthoritativeClubSubscription({
        plan: "business",
        status: row.status,
        trial_expires_at: null,
        plan_expires_at: row.plan_expires_at,
        plans: { code: "business", is_trial: false },
      }, NOW)
      expect(state.isLocked).toBe(true)
    }
  })
})
