import type ExcelJS from "exceljs"

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
}

/** Shared FitCRM spreadsheet treatment for readable exports in Excel and Sheets. */
export function styleDataWorksheet(worksheet: ExcelJS.Worksheet) {
  const lastColumn = Math.max(1, worksheet.columnCount)
  const lastRow = Math.max(1, worksheet.rowCount)

  worksheet.views = [{ state: "frozen", ySplit: 1 }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: lastColumn },
  }
  worksheet.pageSetup = {
    orientation: lastColumn > 5 ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }

  const header = worksheet.getRow(1)
  header.height = 24
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } }
    cell.alignment = { vertical: "middle", horizontal: "left" }
  })

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.height = 21
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER
      cell.alignment = { vertical: "middle", wrapText: true }
      if (rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } }
      }
    })
  }

  worksheet.columns.forEach((column) => {
    column.width = Math.min(48, Math.max(12, column.width ?? 12))
  })
}

export function styleWorkbook(workbook: ExcelJS.Workbook) {
  workbook.worksheets.forEach(styleDataWorksheet)
}
