import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { sanitizeSpreadsheetValue, serializeCSV } from "../../src/lib/csv"
import { styleWorkbook } from "../../src/lib/xlsx"

describe("CSV export", () => {
  it("preserves Cyrillic, commas, quotes and line breaks", () => {
    const csv = serializeCSV(["Имя", "Заметка"], [["Камила", 'зал, "центр"\nэтаж 2']])

    expect(csv).toBe('"Имя","Заметка"\r\n"Камила","зал, ""центр""\nэтаж 2"')
  })

  it.each(["=2+2", "+SUM(A1:A2)", "-1+1", "@cmd", "\tformula", "\rformula"])(
    "neutralizes spreadsheet formula value %s",
    (value) => expect(sanitizeSpreadsheetValue(value)).toBe(`'${value}`),
  )

  it("keeps actual numbers numeric", () => {
    expect(sanitizeSpreadsheetValue(-1500)).toBe(-1500)
  })
})

describe("XLSX export styling", () => {
  it("writes a readable workbook with filters and a frozen header", async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Клиенты")
    sheet.columns = [
      { header: "Имя", key: "name", width: 24 },
      { header: "Телефон", key: "phone", width: 18 },
    ]
    sheet.addRow({ name: "Таджибаева Камила", phone: "+998901234567" })
    styleWorkbook(workbook)

    const buffer = await workbook.xlsx.writeBuffer()
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer)
    const reopenedSheet = reopened.getWorksheet("Клиенты")

    expect(reopenedSheet?.getCell("A2").value).toBe("Таджибаева Камила")
    expect(reopenedSheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 })
    expect(reopenedSheet?.autoFilter).toEqual("A1:B2")
    expect(reopenedSheet?.getCell("A1").font.bold).toBe(true)
  })
})
