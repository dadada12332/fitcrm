export type ImportExtraFields = Record<string, string>

export type ClientImportData = {
  sourceFile?: string
  sourceRow?: number
  importedAt?: string
  extraFields: ImportExtraFields
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/

export function normalizeImportPhone(value?: string | null): string | null {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.length === 12 && digits.startsWith("998")) return digits.slice(-9)
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return digits.slice(-10)
  return digits
}

export function normalizeImportEmail(value?: string | null): string | null {
  const email = String(value ?? "").trim().toLowerCase()
  return email && EMAIL_RE.test(email) ? email : null
}

export function parseImportMoney(value?: string | null): number | null {
  let raw = String(value ?? "").trim().replace(/[^\d.,+\-\s']/g, "")
  if (!raw) return null
  raw = raw.replace(/[\s']/g, "")

  const comma = raw.lastIndexOf(",")
  const dot = raw.lastIndexOf(".")
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : "."
    const thousands = decimal === "," ? /\./g : /,/g
    raw = raw.replace(thousands, "").replace(decimal, ".")
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : "."
    const parts = raw.split(separator)
    const looksGrouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1)
    raw = looksGrouped ? parts.join("") : raw.replace(separator, ".")
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseImportInteger(value?: string | null): number | null {
  const cleaned = String(value ?? "").trim().replace(/[^\d+-]/g, "")
  if (!cleaned) return null
  const parsed = Number.parseInt(cleaned, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function parseImportDate(value?: string | null): string | null {
  const input = String(value ?? "").trim()
  if (!input) return null

  let year: number
  let month: number
  let day: number
  let match = input.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (match) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
  } else {
    match = input.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/)
    if (!match) return null
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3])
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function parseImportDateTime(value?: string | null): string | null {
  const input = String(value ?? "").trim()
  if (!input) return null
  if (/[:t]/i.test(input)) {
    const timestamp = Date.parse(input)
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString()
  }
  const date = parseImportDate(input)
  return date ? `${date}T12:00:00.000Z` : null
}

function delimiterScore(text: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index++
      else quoted = !quoted
    } else if (!quoted && char === delimiter) count++
    else if (!quoted && (char === "\n" || char === "\r")) break
  }
  return count
}

export function detectImportDelimiter(text: string): string {
  return [",", ";", "\t", "|"]
    .map((delimiter) => ({ delimiter, score: delimiterScore(text, delimiter) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? ","
}

export function parseDelimitedText(text: string, delimiter = detectImportDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false
  const source = text.replace(/^\uFEFF/, "")

  const pushValue = () => { row.push(value.trim()); value = "" }
  const pushRow = () => {
    pushValue()
    if (row.some((cell) => cell.trim())) rows.push(row)
    row = []
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index++ }
      else quoted = !quoted
      continue
    }
    if (!quoted && char === delimiter) { pushValue(); continue }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index++
      pushRow()
      continue
    }
    value += char
  }
  if (value.length || row.length) pushRow()
  return rows
}

export function mergeImportData(
  current: unknown,
  incoming: Omit<ClientImportData, "importedAt">,
  importedAt = new Date().toISOString(),
): ClientImportData {
  const existing = current && typeof current === "object" ? current as Partial<ClientImportData> : {}
  const existingFields = existing.extraFields && typeof existing.extraFields === "object" ? existing.extraFields : {}
  return {
    sourceFile: incoming.sourceFile || existing.sourceFile,
    sourceRow: incoming.sourceRow ?? existing.sourceRow,
    importedAt,
    extraFields: { ...existingFields, ...incoming.extraFields },
  }
}
