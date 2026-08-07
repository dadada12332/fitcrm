import { describe, expect, it } from "vitest"
import {
  applyStaffPermissionOverrides,
  can,
  getDefaultPermissions,
  mergePermissions,
} from "../../src/lib/permissions"

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

  it("assigns lead capabilities by operational role", () => {
    const admin = getDefaultPermissions("admin")
    const manager = getDefaultPermissions("manager")
    const cashier = getDefaultPermissions("cashier")

    expect(admin.leads).toEqual({
      view: true,
      create: true,
      edit: true,
      assign: true,
      convert: true,
      archive: false,
    })
    expect(manager.leads).toEqual(admin.leads)
    expect(cashier.leads).toEqual({
      view: true,
      create: true,
      edit: true,
      assign: false,
      convert: true,
      archive: false,
    })
    expect(allPermissionValues(getDefaultPermissions("trainer").leads)).not.toContain(true)
    expect(allPermissionValues(getDefaultPermissions("accountant").leads)).not.toContain(true)
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

  it("applies individual staff restrictions after the role", () => {
    const manager = getDefaultPermissions("manager")
    const restricted = applyStaffPermissionOverrides(manager, {
      clients: false,
      visits: false,
      payments: false,
    })

    expect(allPermissionValues(restricted.clients)).not.toContain(true)
    expect(allPermissionValues(restricted.visits)).not.toContain(true)
    expect(allPermissionValues(restricted.payments)).not.toContain(true)
    expect(restricted.leads).not.toBe(manager.leads)
    expect(manager.clients.view).toBe(true)
  })

  it("an individual switch grants entry but not destructive actions", () => {
    const trainer = getDefaultPermissions("trainer")
    const result = applyStaffPermissionOverrides(trainer, {
      payments: true,
      inventory: true,
      finance: true,
    })

    expect(result.payments.view).toBe(true)
    expect(result.payments.refund).toBe(false)
    expect(result.warehouse.view).toBe(true)
    expect(result.warehouse.writeoff).toBe(false)
    expect(result.reports.finance).toBe(true)
  })
})
