import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

describe("Telegram role-aware Mini App", () => {
  it("resolves every linked user against the active club record", () => {
    const actor = read("src/lib/telegram/actor.ts")

    expect(actor).toContain('.from("telegram_users")')
    expect(actor).toContain('.eq("club_id", clubId)')
    expect(actor).toContain('.eq("id", link.staff_id)')
    expect(actor).toContain('.eq("is_active", true)')
    expect(actor).toContain('.eq("id", link.client_id)')
    expect(actor).toContain("getDefaultPermissions(staff.role)")
    expect(actor).toContain("applyStaffPermissionOverrides(rolePermissions, settings.permissions)")
    expect(actor).toContain("applyPlanToPermissions(")
  })

  it("returns a staff workspace only after Telegram initData validation", () => {
    const route = read("src/app/api/telegram/miniapp/[clubId]/route.ts")

    expect(route).toContain("validateTelegramMiniAppInitData")
    expect(route).toContain("resolveTelegramActor(clubId, auth.user.id)")
    expect(route).toContain('if (actor.kind === "staff")')
    expect(route).toContain('if (action !== "bootstrap")')
    expect(route).toContain("buildTelegramStaffMiniApp(actor)")
  })

  it("derives staff data and callbacks from CRM permissions", () => {
    const builder = read("src/lib/telegram/staff-miniapp.ts")
    const bot = read("src/lib/telegram/bot.ts")

    expect(builder).toContain('can(actor.permissions, "dashboard", "view_finance")')
    expect(builder).toContain('can(actor.permissions, "visits", "view")')
    expect(builder).toContain('can(actor.permissions, "schedule", "view")')
    expect(builder.match(/\.eq\("club_id", actor\.clubId\)/g)?.length).toBeGreaterThanOrEqual(8)
    expect(builder).toContain('if (actor.role === "trainer") scheduleQuery = scheduleQuery.eq("staff_id", actor.staffId)')
    expect(bot).toContain("canUseStaffCallback(tgUser, data)")
    expect(bot).toContain("staffMenu(tgUser)")
    expect(bot).toContain('getTodaySchedule(clubId, scheduleStaffId)')
    expect(bot).toContain('tgUser.role === "trainer" ? tgUser.staff_id')
  })

  it("keeps default commands neutral until a user is linked", () => {
    const api = read("src/lib/telegram/api.ts")
    const commands = api.slice(api.indexOf('callTelegramApi(token, "setMyCommands"'), api.indexOf('callTelegramApi(token, "setChatMenuButton"'))

    expect(commands).toContain('{ command: "start"')
    expect(commands).toContain('{ command: "menu"')
    expect(commands).toContain('{ command: "help"')
    expect(commands).not.toContain('{ command: "sub"')
    expect(commands).not.toContain('{ command: "schedule"')
    expect(commands).not.toContain('{ command: "qr"')
  })
})
