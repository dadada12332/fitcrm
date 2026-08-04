import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import {
  readPlanCapacityUsage,
  requiresPlanCapacityCheck,
  resolvePlanCapacityUsage,
  type PlanCapacityCountResults,
} from "../../src/lib/plan-capacity"

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function successfulCounts(): PlanCapacityCountResults {
  return {
    clients: { count: 12, error: null },
    staff: { count: 3, error: null },
    staffInvitations: { count: 2, error: null },
    branches: { count: 2, error: null },
    products: { count: 7, error: null },
    roles: { count: 1, error: null },
    telegramIntegrations: { count: 1, error: null },
    integrationConnections: { count: 2, error: null },
    accessControlIntegrations: { count: 3, error: null },
    paymentConnections: { count: 1, error: null },
  }
}

describe("plan capacity reads", () => {
  it("combines only successful exact counts", () => {
    expect(resolvePlanCapacityUsage(successfulCounts())).toEqual({
      clients: 12,
      staff: 5,
      branches: 2,
      products: 7,
      roles: 1,
      integrations: 7,
    })
  })

  it("fails closed when any count query reports an error", () => {
    const counts = successfulCounts()
    counts.products = { count: null, error: { message: "query failed" } }
    expect(resolvePlanCapacityUsage(counts)).toBeNull()
  })

  it("fails closed when a query has no error but omits its exact count", () => {
    const counts = successfulCounts()
    counts.branches = { count: null, error: null }
    expect(resolvePlanCapacityUsage(counts)).toBeNull()
  })

  it("does not apply capacity blockers to same-plan renewals", () => {
    expect(requiresPlanCapacityCheck(
      { id: "standard-id", code: "standard" },
      { id: "standard-id", code: "renamed-standard" },
    )).toBe(false)
    expect(requiresPlanCapacityCheck(
      { id: null, code: "standard" },
      { id: "standard-id", code: "standard" },
    )).toBe(false)
    expect(requiresPlanCapacityCheck(
      { id: "standard-id", code: "standard" },
      { id: "starter-id", code: "starter" },
    )).toBe(true)
  })

  it("counts only pending staff invitations that have not expired", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-04T10:00:00.000Z"))

    const countQueries: Array<{ table: string; gt: ReturnType<typeof vi.fn> }> = []
    let clubQueryCount = 0
    const service = {
      from: vi.fn((table: string) => {
        if (table === "clubs" && clubQueryCount++ === 0) {
          const clubQuery = {
            select: vi.fn(() => clubQuery),
            eq: vi.fn(() => clubQuery),
            maybeSingle: vi.fn(async () => ({ data: { owner_id: "owner-id" }, error: null })),
          }
          return clubQuery
        }

        const countQuery = {
          table,
          select: vi.fn(() => countQuery),
          eq: vi.fn(() => countQuery),
          is: vi.fn(() => countQuery),
          gt: vi.fn(() => countQuery),
          in: vi.fn(() => countQuery),
          neq: vi.fn(() => countQuery),
          then: (
            onFulfilled: (value: { count: number; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve({ count: 0, error: null }).then(onFulfilled, onRejected),
        }
        countQueries.push(countQuery)
        return countQuery
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(service as never)

    await expect(readPlanCapacityUsage("club-id")).resolves.toEqual({
      clients: 0,
      staff: 0,
      branches: 0,
      products: 0,
      roles: 0,
      integrations: 0,
    })

    const invitationQuery = countQueries.find(({ table }) => table === "staff_invitations")
    expect(invitationQuery?.gt).toHaveBeenCalledWith("expires_at", "2026-08-04T10:00:00.000Z")
    expect(countQueries.some(({ table }) => table === "access_control_integrations")).toBe(true)
  })
})
