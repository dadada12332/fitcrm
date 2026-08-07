import { describe, expect, it } from "vitest"
import { applyPlanToPermissions, planLimitError, type PlanAccess } from "../../src/lib/plan-access"
import { getDefaultPermissions } from "../../src/lib/permissions"
import { formatPlanLimitError, LIMIT_KEYS, parsePlanLimitError } from "../../src/lib/plan-limits"

function allPermissionValues(value: object): boolean[] {
  return Object.values(value).flatMap((entry) =>
    typeof entry === "object" && entry !== null ? allPermissionValues(entry) : [entry === true],
  )
}

function access(overrides: Partial<PlanAccess> = {}): PlanAccess {
  return {
    code: "starter",
    name: "Starter",
    features: { crm: true, leads: true, reports: true, warehouse: true, inbox: true, ai: false, telegram: true, finance: true, export: true },
    sections: { dashboard: true, leads: true, clients: true, payments: true, reports: true, staff: false, integrations: true, ai: true },
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

  it("requires the Leads section, Leads feature and CRM feature together", () => {
    const owner = getDefaultPermissions("owner")
    const withoutSection = applyPlanToPermissions(owner, access({
      sections: { dashboard: true, leads: false, clients: true },
    }))
    const withoutFeature = applyPlanToPermissions(owner, access({
      features: { crm: true, leads: false, export: true },
    }))
    const withoutCrm = applyPlanToPermissions(owner, access({
      features: { crm: false, leads: true, export: true },
    }))

    expect(allPermissionValues(withoutSection.leads)).not.toContain(true)
    expect(allPermissionValues(withoutFeature.leads)).not.toContain(true)
    expect(allPermissionValues(withoutCrm.leads)).not.toContain(true)
  })

  it("keeps Lead Hub enabled while export entitlements gate supported exports", () => {
    const owner = getDefaultPermissions("owner")
    const result = applyPlanToPermissions(owner, access({
      features: { crm: true, leads: true, export: false },
    }))

    expect(result.leads.view).toBe(true)
    expect(result.leads.convert).toBe(true)
    expect(result.clients.export).toBe(false)
    expect(result.payments.export).toBe(false)
    expect(result.reports.export).toBe(false)
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
