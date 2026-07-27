import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  path.join(process.cwd(), "src/app/(app)/profile/actions.ts"),
  "utf8",
)

function actionBody(name: string, nextName?: string): string {
  const start = source.indexOf(`export async function ${name}`)
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start) : source.length
  return source.slice(start, end)
}

describe("profile actions", () => {
  it("scopes staff profile synchronization to the current user and club", () => {
    const body = actionBody("updateProfileAction", "updateAvatarPresetAction")

    expect(body).toContain("getCurrentClub()")
    expect(body).toContain('.eq("club_id", club.clubId)')
    expect(body).toContain('.eq("user_id", user.id)')
    expect(body).toContain('.eq("is_active", true)')
    expect(body).toContain('.eq("id", staff.id)')
  })

  it("disconnects only the current staff Telegram link in the active club", () => {
    const body = actionBody("disconnectProfileTelegramAction")

    expect(body).toContain("getCurrentClub()")
    expect(body.match(/\.eq\("club_id", club\.clubId\)/g)).toHaveLength(2)
    expect(body).toContain('.eq("user_id", user.id)')
    expect(body).toContain('.eq("staff_id", staff.id)')
  })

  it("keeps password verification and minimum length on the server", () => {
    const body = actionBody("updatePasswordAction", "updateEmailAction")

    expect(body).toContain("input.newPassword.length < 8")
    expect(body).toContain("signInWithPassword")
    expect(body).toContain("currentPassword")
  })
})
