import { describe, expect, it } from "vitest"
import { can, getDefaultPermissions, mergePermissions } from "../../src/lib/permissions"

function allPermissionValues(value: object): boolean[] {
  return Object.values(value).flatMap((entry) =>
    typeof entry === "object" && entry !== null ? allPermissionValues(entry) : [entry === true],
  )
}

describe("role permissions", () => {
  it("grants every capability to an owner", () => {
    expect(allPermissionValues(getDefaultPermissions("owner"))).not.toContain(false)
  })

  it("denies every capability for an unknown role", () => {
    expect(allPermissionValues(getDefaultPermissions("corrupted-role"))).not.toContain(true)
  })

  it("does not grant financial or destructive access to a trainer", () => {
    const trainer = getDefaultPermissions("trainer")

    expect(can(trainer, "payments", "view_revenue")).toBe(false)
    expect(can(trainer, "clients", "delete")).toBe(false)
    expect(can(trainer, "staff", "salaries")).toBe(false)
    expect(can(trainer, "visits", "checkin")).toBe(true)
  })

  it("merges a custom role without mutating its base", () => {
    const base = getDefaultPermissions("trainer")
    const result = mergePermissions(base, { clients: { ...base.clients, create: true } })

    expect(result.clients.create).toBe(true)
    expect(base.clients.create).toBe(false)
  })

  it("denies unknown modules and actions", () => {
    const manager = getDefaultPermissions("manager")

    expect(can(manager, "payments", "unknown")).toBe(false)
  })
})
