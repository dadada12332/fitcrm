import { describe, expect, it } from "vitest"
import {
  PLATFORM_SUBSCRIPTION_WARNING_DAYS,
  resolvePlatformSubscription,
} from "../../src/lib/platform-subscription"

const NOW = Date.UTC(2026, 7, 4, 10)

function paid(expiresAt: string | null, status = "active") {
  return resolvePlatformSubscription({
    plan: "business",
    status,
    planExpiresAt: expiresAt,
    trialExpiresAt: null,
    now: NOW,
  })
}

describe("platform subscription lifecycle", () => {
  it("keeps the assigned plan separate from an expired paid period", () => {
    const state = paid("2026-08-03T10:00:00.000Z")
    expect(state.kind).toBe("expired")
    expect(state.daysLeft).toBe(0)
    expect(state.isLocked).toBe(true)
    expect(state.canRenew).toBe(true)
  })

  it("starts the warning state seven days before expiry", () => {
    const state = paid(new Date(NOW + PLATFORM_SUBSCRIPTION_WARNING_DAYS * 86_400_000).toISOString())
    expect(state.kind).toBe("expiring")
    expect(state.daysLeft).toBe(7)
    expect(state.needsAttention).toBe(true)
  })

  it("does not warn before the configured window", () => {
    const state = paid(new Date(NOW + 8 * 86_400_000).toISOString())
    expect(state.kind).toBe("active")
    expect(state.needsAttention).toBe(false)
  })

  it("locks exactly at the expiry timestamp", () => {
    const state = paid(new Date(NOW).toISOString())
    expect(state.kind).toBe("expired")
    expect(state.isLocked).toBe(true)
  })

  it("keeps a paid plan without an expiry as explicitly unlimited", () => {
    const state = paid(null)
    expect(state.kind).toBe("unlimited")
    expect(state.isLocked).toBe(false)
    expect(state.canRenew).toBe(false)
  })

  it("distinguishes trial expiry from paid-plan expiry", () => {
    const state = resolvePlatformSubscription({
      plan: "trial",
      status: "active",
      trialExpiresAt: "2026-08-03T10:00:00.000Z",
      planExpiresAt: null,
      now: NOW,
    })
    expect(state.kind).toBe("trial_expired")
    expect(state.isTrial).toBe(true)
  })

  it("fails closed when a trial is missing its required expiry", () => {
    const state = resolvePlatformSubscription({
      plan: "trial",
      status: "active",
      trialExpiresAt: null,
      planExpiresAt: null,
      now: NOW,
    })
    expect(state.kind).toBe("trial_expired")
    expect(state.isLocked).toBe(true)
  })

  it("lets an operational suspension override billing state", () => {
    const state = paid(new Date(NOW + 30 * 86_400_000).toISOString(), "suspended")
    expect(state.kind).toBe("suspended")
    expect(state.isLocked).toBe(true)
    expect(state.canRenew).toBe(false)
  })

  it("fails closed for deleted or unknown administrative club states", () => {
    for (const status of ["deleted", "pending_review"]) {
      const state = paid(new Date(NOW + 30 * 86_400_000).toISOString(), status)
      expect(state.kind).toBe("suspended")
      expect(state.isLocked).toBe(true)
      expect(state.canRenew).toBe(false)
    }
  })

  it("fails closed when a non-null expiry is malformed", () => {
    const state = paid("not-a-date")
    expect(state.kind).toBe("expired")
    expect(state.isLocked).toBe(true)
  })
})
