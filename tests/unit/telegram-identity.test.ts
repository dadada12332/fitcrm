import { describe, expect, it } from "vitest"
import { normalizeTelegramPhone, telegramDisplayName } from "../../src/lib/telegram/identity"

describe("Telegram client identity", () => {
  it("normalizes common Uzbek and Russian phone formats for exact matching", () => {
    expect(normalizeTelegramPhone("+998 90 123-45-67")).toBe("901234567")
    expect(normalizeTelegramPhone("998901234567")).toBe("901234567")
    expect(normalizeTelegramPhone("+7 (999) 123-45-67")).toBe("9991234567")
    expect(normalizeTelegramPhone("8 999 123 45 67")).toBe("9991234567")
  })

  it("keeps Telegram display identity independent from the CRM name", () => {
    expect(telegramDisplayName({ firstName: "Солнышко", lastName: null })).toBe("Солнышко")
  })
})
