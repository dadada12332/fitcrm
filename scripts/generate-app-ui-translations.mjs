import fs from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

const ROOT = process.cwd()
const SOURCE_ROOTS = [
  path.join(ROOT, "src", "app", "(app)"),
  path.join(ROOT, "src", "components", "app"),
  path.join(ROOT, "src", "lib"),
]
const OUTPUTS = {
  en: path.join(ROOT, "src", "lib", "app-ui-translations.en.generated.ts"),
  uz: path.join(ROOT, "src", "lib", "app-ui-translations.uz.generated.ts"),
}
const CYRILLIC = /[А-Яа-яЁё]/
const SPLITTER = "\n[[[ZALKINS_SPLIT_9F3A]]]\n"

const MANUAL_EN = {
  "Абонемент": "Membership",
  "Абонементы": "Memberships",
  "Активные": "Active",
  "Все": "All",
  "Выручка": "Revenue",
  "Далее": "Continue",
  "Дней заморозки": "Freeze days",
  "Дней заморозки (0 = недоступна)": "Freeze days (0 = unavailable)",
  "Дней заморозки не может быть больше срока абонемента": "Freeze days cannot exceed the membership duration",
  "Закрыть": "Close",
  "Заморозка —": "Freeze —",
  "Истекающие": "Expiring",
  "Истекающие абонементы": "Expiring memberships",
  "Клиент": "Client",
  "Клиенты": "Clients",
  "Назад": "Back",
  "Новый клиент": "New client",
  "Оплаты": "Payments",
  "Отмена": "Cancel",
  "Подтвердить": "Confirm",
  "Поиск": "Search",
  "Посещения": "Visits",
  "Продлить": "Renew",
  "Расписание": "Schedule",
  "Склад": "Inventory",
  "Сохранить": "Save",
  "Сотрудники": "Staff",
  "Удержание": "Retention",
  "выросла": "increased",
  "снизилась": "decreased",
  "__DATE_YEAR__": "yr.",
  "г": "г",
  "янв": "Jan",
  "фев": "Feb",
  "мар": "Mar",
  "апр": "Apr",
  "май": "May",
  "июн": "Jun",
  "июл": "Jul",
  "авг": "Aug",
  "сен": "Sep",
  "окт": "Oct",
  "ноя": "Nov",
  "дек": "Dec",
  "январь": "January",
  "февраль": "February",
  "март": "March",
  "апрель": "April",
  "июнь": "June",
  "июль": "July",
  "август": "August",
  "сентябрь": "September",
  "октябрь": "October",
  "ноябрь": "November",
  "декабрь": "December",
}

const MANUAL_UZ = {
  "Абонемент": "Abonement",
  "Абонементы": "Abonementlar",
  "Активные": "Faol",
  "Все": "Barchasi",
  "Выручка": "Tushum",
  "Далее": "Davom etish",
  "Дней заморозки": "Muzlatish kunlari",
  "Дней заморозки (0 = недоступна)": "Muzlatish kunlari (0 = mavjud emas)",
  "Дней заморозки не может быть больше срока абонемента": "Muzlatish kunlari abonement muddatidan oshmasligi kerak",
  "Закрыть": "Yopish",
  "Заморозка —": "Muzlatish —",
  "Истекающие": "Muddati tugayotgan",
  "Истекающие абонементы": "Muddati tugayotgan abonementlar",
  "Клиент": "Mijoz",
  "Клиенты": "Mijozlar",
  "Назад": "Orqaga",
  "Новый клиент": "Yangi mijoz",
  "Оплаты": "To‘lovlar",
  "Отмена": "Bekor qilish",
  "Подтвердить": "Tasdiqlash",
  "Поиск": "Qidiruv",
  "Посещения": "Tashriflar",
  "Продлить": "Uzaytirish",
  "Расписание": "Jadval",
  "Склад": "Ombor",
  "Сохранить": "Saqlash",
  "Сотрудники": "Xodimlar",
  "Удержание": "Mijozlarni saqlash",
  "выросла": "oshdi",
  "снизилась": "kamaydi",
  "__DATE_YEAR__": "y.",
  "г": "г",
  "янв": "yan",
  "фев": "fev",
  "мар": "mar",
  "апр": "apr",
  "май": "may",
  "июн": "iyun",
  "июл": "iyul",
  "авг": "avg",
  "сен": "sen",
  "окт": "okt",
  "ноя": "noy",
  "дек": "dek",
  "январь": "yanvar",
  "февраль": "fevral",
  "март": "mart",
  "апрель": "aprel",
  "июнь": "iyun",
  "июль": "iyul",
  "август": "avgust",
  "сентябрь": "sentabr",
  "октябрь": "oktabr",
  "ноябрь": "noyabr",
  "декабрь": "dekabr",
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes("app-ui-translations.")) files.push(full)
  }
  return files
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim()
}

function templateValue(node) {
  if (!ts.isTemplateExpression(node)) return null
  let value = node.head.text
  node.templateSpans.forEach((span, index) => {
    value += `{${index}}${span.literal.text}`
  })
  return normalize(value)
}

function collectFromSource(file, source) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
  const exact = new Set()
  const patterns = new Set()

  function addExact(value) {
    const normalized = normalize(value)
    if (normalized && normalized.length <= 360 && CYRILLIC.test(normalized)) exact.add(normalized)
  }

  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) addExact(node.text)
    if (ts.isTemplateExpression(node)) {
      const value = templateValue(node)
      if (value && CYRILLIC.test(value)) patterns.add(value)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return { exact, patterns }
}

function batches(values) {
  const result = []
  let current = []
  let length = 0
  for (const value of values) {
    const addition = value.length + SPLITTER.length
    if (current.length && length + addition > 3500) {
      result.push(current)
      current = []
      length = 0
    }
    current.push(value)
    length += addition
  }
  if (current.length) result.push(current)
  return result
}

async function translateBatch(values, target) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "ru",
    tl: target,
    dt: "t",
    q: values.join(SPLITTER),
  })
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`)
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`)
  const payload = await response.json()
  const combined = (payload[0] ?? []).map((part) => part[0]).join("")
  const translated = combined.split(SPLITTER).map(normalize)
  if (translated.length !== values.length) {
    throw new Error(`Translation split mismatch: ${values.length} source / ${translated.length} target`)
  }
  return translated
}

async function translateAll(values, target) {
  const result = new Map()
  const chunks = batches(values)
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    const translated = await translateBatch(chunk, target)
    chunk.forEach((source, itemIndex) => result.set(source, translated[itemIndex]))
    process.stdout.write(`\r${target}: ${index + 1}/${chunks.length}`)
  }
  process.stdout.write("\n")
  return result
}

function serializeRecord(entries) {
  return entries
    .map(([source, value]) => `  ${JSON.stringify(source)}: ${JSON.stringify(value)},`)
    .join("\n")
}

function serializePatterns(patterns, translations) {
  return patterns
    .map((source) => `  { source: ${JSON.stringify(source)}, value: ${JSON.stringify(translations.get(source) ?? source)} },`)
    .join("\n")
}

const files = (await Promise.all(SOURCE_ROOTS.map(walk))).flat()
const exact = new Set()
const patterns = new Set()
for (const file of files) {
  const source = await fs.readFile(file, "utf8")
  const collected = collectFromSource(file, source)
  collected.exact.forEach((value) => exact.add(value))
  collected.patterns.forEach((value) => patterns.add(value))
}
Object.keys(MANUAL_EN).forEach((value) => exact.add(value))
Object.keys(MANUAL_UZ).forEach((value) => exact.add(value))

const all = [...new Set([...exact, ...patterns])].sort((a, b) => a.localeCompare(b, "ru"))
console.log(`Collected ${exact.size} exact strings and ${patterns.size} patterns from ${files.length} files.`)

const [en, uz] = await Promise.all([translateAll(all, "en"), translateAll(all, "uz")])
Object.entries(MANUAL_EN).forEach(([source, value]) => en.set(source, value))
Object.entries(MANUAL_UZ).forEach(([source, value]) => uz.set(source, value))

const exactSorted = [...exact].sort((a, b) => a.localeCompare(b, "ru"))
const patternSorted = [...patterns].sort((a, b) => a.localeCompare(b, "ru"))
for (const [locale, translations] of [["en", en], ["uz", uz]]) {
  const output = `// Generated by scripts/generate-app-ui-translations.mjs.
// Russian source copy is the stable lookup key; user and club data are never translated.
export const APP_UI_COPY: Record<string, string> = {
${serializeRecord(exactSorted.map((source) => [source, translations.get(source) ?? source]))}
}

export const APP_UI_PATTERNS = [
${serializePatterns(patternSorted, translations)}
] as const
`
  await fs.writeFile(OUTPUTS[locale], output)
  console.log(`Wrote ${path.relative(ROOT, OUTPUTS[locale])}.`)
}
