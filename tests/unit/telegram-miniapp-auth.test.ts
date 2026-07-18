import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { validateTelegramMiniAppInitData } from "../../src/lib/telegram/miniapp-auth"

function signedInitData(token: string, authDate: number) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAE-test",
    user: JSON.stringify({ id: 123456, first_name: "Amir", username: "amir" }),
  })
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("\n")
  const secret = createHmac("sha256", "WebAppData").update(token).digest()
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"))
  return params.toString()
}

describe("Telegram Mini App initData", () => {
  it("accepts fresh data signed by the club bot", () => {
    const now = 1_800_000_000
    const result = validateTelegramMiniAppInitData(signedInitData("123:test-token", now), "123:test-token", now)
    expect(result?.user.id).toBe(123456)
    expect(result?.queryId).toBe("AAE-test")
  })

  it("rejects tampering, wrong bot and expired data", () => {
    const now = 1_800_000_000
    const valid = signedInitData("123:test-token", now)
    expect(validateTelegramMiniAppInitData(valid.replace("Amir", "Other"), "123:test-token", now)).toBeNull()
    expect(validateTelegramMiniAppInitData(valid, "456:other-token", now)).toBeNull()
    expect(validateTelegramMiniAppInitData(signedInitData("123:test-token", now - 601), "123:test-token", now)).toBeNull()
  })
})
