import { describe, expect, it } from "vitest"
import { applyPlanToPermissions, planLimitError, type PlanAccess } from "../../src/lib/plan-access"
import { getDefaultPermissions } from "../../src/lib/permissions"
import { formatPlanLimitError, LIMIT_KEYS, parsePlanLimitError } from "../../src/lib/plan-limits"

function access(overrides: Partial<PlanAccess> = {}): PlanAccess {
  return {
    code: "starter",
    name: "Starter",
    features: { crm: true, reports: true, warehouse: true, inbox: true, ai: false, telegram: true, finance: true, export: true },
    sections: { dashboard: true, clients: true, payments: true, reports: true, staff: false, integrations: true, ai: true },
    limits: { clients: 1000 },
    ...overrides,
  }
}

describe("plan access", () => {
  it("can only remove role permissions", () => {
    const owner = getDefaultPermissions("owner")
    const result = applyPlanToPermissions(owner, access())

    expect(result.clients.create).toBe(true)
    expect(result.staff.view).toBe(false)
    expect(result.settings.roles).toBe(false)
    expect(result.ai.use).toBe(false)
  })

  it("does not grant permissions denied by the role", () => {
    const trainer = getDefaultPermissions("trainer")
    const result = applyPlanToPermissions(trainer, access({ features: { ai: true, telegram: true } }))

    expect(result.ai.use).toBe(false)
    expect(result.clients.create).toBe(false)
  })

  it("enforces finite limits and treats null as unlimited", () => {
    const plan = access()
    expect(planLimitError(plan, "clients", 999)).toBeNull()
    expect(planLimitError(plan, "clients", 1000)).toContain("Достигнут лимит")
    expect(planLimitError(access({ limits: { clients: null } }), "clients", 100_000)).toBeNull()
  })

  it.each(LIMIT_KEYS)("enforces the %s boundary", (key) => {
    const plan = access({ limits: { [key]: 3 } })
    expect(planLimitError(plan, key, 2)).toBeNull()
    expect(planLimitError(plan, key, 3)).toContain("Достигнут лимит")
    expect(planLimitError(plan, key, 1, 2)).toBeNull()
    expect(planLimitError(plan, key, 1, 3)).toContain("Достигнут лимит")
  })

  it("keeps enough structured detail for the upgrade dialog", () => {
    const message = formatPlanLimitError("clients", 1_000, "Starter")
    expect(parsePlanLimitError(message)).toEqual({
      key: "clients",
      label: "Клиенты",
      limit: 1_000,
      planName: "Starter",
    })
  })

  it("fails open if plan metadata is temporarily unavailable", () => {
    const owner = getDefaultPermissions("owner")
    expect(applyPlanToPermissions(owner, null)).toBe(owner)
  })
})
