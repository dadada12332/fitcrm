import { describe, expect, it } from "vitest"
import { sanitizeSearchTerm } from "../../src/lib/search"

describe("sanitizeSearchTerm", () => {
  it("removes PostgREST filter grammar characters", () => {
    expect(sanitizeSearchTerm("  alice,or(name.ilike.*admin*)%  ")).toBe("alice or name.ilike. admin")
  })

  it("collapses whitespace and backslashes", () => {
    expect(sanitizeSearchTerm("Ali\\   Vali\nKarim")).toBe("Ali Vali Karim")
  })

  it("limits input length before interpolation", () => {
    expect(sanitizeSearchTerm("a".repeat(100), 12)).toHaveLength(12)
  })

  it("handles empty input", () => {
    expect(sanitizeSearchTerm("")).toBe("")
  })
})
