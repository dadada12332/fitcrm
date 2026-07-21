export type CsvValue = string | number | boolean | null | undefined

/** Prevent values from being interpreted as formulas when a CSV is opened in Excel. */
export function sanitizeSpreadsheetValue(value: CsvValue): string | number | boolean {
  if (typeof value !== "string") return value ?? ""
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function serializeCSV(headers: string[], rows: CsvValue[][]): string {
  const escape = (value: CsvValue) => {
    const safe = sanitizeSpreadsheetValue(value)
    return `"${String(safe).replace(/"/g, '""')}"`
  }

  return [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n")
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCSV(filename: string, headers: string[], rows: CsvValue[][]) {
  const content = serializeCSV(headers, rows)
  downloadBlob(filename, new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" }))
}
