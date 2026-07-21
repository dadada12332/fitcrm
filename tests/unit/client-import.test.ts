import { describe, expect, it } from "vitest"
import {
  mergeImportData,
  normalizeImportEmail,
  normalizeImportPhone,
  parseDelimitedText,
  parseImportDate,
  parseImportMoney,
} from "../../src/lib/client-import"

describe("client import normalization", () => {
  it("matches Uzbekistan and CIS phone formatting consistently", () => {
    expect(normalizeImportPhone("+998 (90) 123-45-67")).toBe("901234567")
    expect(normalizeImportPhone("8 (999) 123-45-67")).toBe("9991234567")
  })

  it("normalizes only valid email addresses", () => {
    expect(normalizeImportEmail(" User@Example.COM ")).toBe("user@example.com")
    expect(normalizeImportEmail("not-an-email")).toBeNull()
  })

  it("parses common localized money formats", () => {
    expect(parseImportMoney("1 234 567,50 сум")).toBe(1234567.5)
    expect(parseImportMoney("1,234.56")).toBe(1234.56)
    expect(parseImportMoney("1.234,56")).toBe(1234.56)
  })

  it("rejects impossible calendar dates", () => {
    expect(parseImportDate("31.02.2026")).toBeNull()
    expect(parseImportDate("29.02.2024")).toBe("2024-02-29")
  })

  it("parses escaped quotes and multiline CSV fields", () => {
    expect(parseDelimitedText('Имя;Комментарий\r\n"Иванов, Иван";"Любит ""утро""\nи бассейн"')).toEqual([
      ["Имя", "Комментарий"],
      ["Иванов, Иван", 'Любит "утро"\nи бассейн'],
    ])
  })

  it("merges source fields without losing prior import data", () => {
    expect(mergeImportData(
      { sourceFile: "old.csv", extraFields: { "Скидка": "10%", "ID": "42" } },
      { sourceFile: "new.csv", sourceRow: 3, extraFields: { "Скидка": "15%" } },
      "2026-07-21T10:00:00.000Z",
    )).toEqual({
      sourceFile: "new.csv",
      sourceRow: 3,
      importedAt: "2026-07-21T10:00:00.000Z",
      extraFields: { "Скидка": "15%", "ID": "42" },
    })
  })
})
