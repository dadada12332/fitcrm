/**
 * FitCRM Import Wizard — config-driven field map + competitive scoring.
 *
 * Three column categories:
 *   importable  — user can map & import
 *   computed    — calculated by system (last_visit, visit_count…) — show info badge, no mapping
 *   system      — internal IDs / timestamps — show lock badge, no mapping
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type FieldKey =
  | "first_name" | "last_name" | "full_name"
  | "phone" | "email" | "birth_date" | "gender"
  | "source" | "notes" | "balance" | "debt" | "trainer"
  | "membership_name" | "sub_status" | "sub_start" | "sub_end" | "visits_total" | "last_visit"
  | "custom" | "__skip__"

export type ColStatus   = "auto" | "suggested" | "manual" | "unknown" | "skip"
export type ColCategory = "importable" | "computed" | "system"

export interface ImportFieldDef {
  key: FieldKey
  label: string
  required: boolean
  /** false = multiple columns combine (e.g. first_name + last_name) */
  unique: boolean
  group: "client" | "subscription"
  description?: string
  aliases: string[]
}

export interface DetectionResult {
  key: FieldKey
  confidence: number   // 0–100
  stage: 1 | 2 | 3 | 4
}

export interface MappingEntry {
  fileCol: string
  fieldKey: FieldKey
  customLabel?: string
  detection?: DetectionResult
}

export interface ParsedFile {
  headers: string[]
  rows: string[][]
  totalRows: number
  fileName: string
  fileSize: number
}

export interface ValidatedRow {
  index: number
  values: Record<FieldKey, string>
  errors: string[]
  dupPhone?: boolean
  extraFields?: Record<string, string>
}

export type DuplicateStrategy = "skip" | "update" | "create"

// ── IMPORTABLE field config ────────────────────────────────────────────────────

export const CLIENT_FIELDS: ImportFieldDef[] = [
  // ── Personal identity ─────────────────────────────────────────────────────
  {
    key: "first_name", label: "Имя", required: false, unique: true,
    group: "client", description: "Имя клиента (без фамилии)",
    aliases: [
      "имя", "имя клиента", "first name", "firstname", "first_name", "name",
      "имя (клиент)", "given name", "givenname",
    ],
  },
  {
    key: "last_name", label: "Фамилия", required: false, unique: true,
    group: "client", description: "Фамилия клиента",
    aliases: [
      "фамилия", "фамилия клиента", "last name", "lastname", "last_name",
      "surname", "family name", "familyname",
    ],
  },
  {
    key: "full_name", label: "Имя клиента (ФИО)", required: false, unique: false,
    group: "client", description: "Полное имя в одной колонке",
    aliases: [
      "фио", "ф.и.о", "ф и о", "полное имя", "имя и фамилия", "фамилия имя",
      "фамилия имя отчество", "фамилия и имя",
      "full name", "fullname", "full_name",
      "клиент", "ученик", "студент", "member", "customer", "participant", "посетитель",
    ],
  },
  {
    key: "phone", label: "Телефон", required: false, unique: true,
    group: "client", description: "+998 XX XXX XX XX",
    aliases: [
      "телефон", "тел", "тел.", "номер телефона", "телефон клиента", "моб", "моб.",
      "мобильный", "номер мобильного",
      "phone", "mobile", "mob", "cell", "cellular", "gsm", "tel", "contact phone",
    ],
  },
  {
    key: "email", label: "Email", required: false, unique: true,
    group: "client",
    aliases: [
      "email", "e-mail", "e mail", "e_mail",
      "почта", "электронная почта", "электронная", "имейл", "емейл",
      "электронный адрес",
    ],
  },
  {
    key: "birth_date", label: "Дата рождения", required: false, unique: true,
    group: "client", description: "ДД.ММ.ГГГГ или ГГГГ-ММ-ДД",
    aliases: [
      "дата рождения", "день рождения", "д.р", "д.р.", "д/р", "дата рожд",
      "birth date", "birthdate", "birth_date", "birthday", "date of birth", "dob", "born",
    ],
  },
  {
    key: "gender", label: "Пол", required: false, unique: true,
    group: "client", description: "м / ж / male / female",
    aliases: ["пол", "гендер", "пол клиента", "gender", "sex"],
  },
  {
    key: "source", label: "Источник", required: false, unique: true,
    group: "client",
    aliases: [
      "источник", "источник клиента", "откуда", "канал привлечения", "как узнал",
      "source", "lead source", "acquisition", "channel", "referral", "utm",
    ],
  },
  {
    key: "notes", label: "Заметки", required: false, unique: true,
    group: "client",
    aliases: [
      "заметки", "заметка", "комментарий", "комментарии", "примечание", "примечания",
      "описание", "доп. информация",
      "notes", "note", "comment", "comments", "remark", "remarks", "description", "info",
    ],
  },
  {
    key: "balance", label: "Баланс", required: false, unique: true,
    group: "client", description: "Денежный баланс клиента (сум)",
    aliases: [
      "баланс", "баланс (сум)", "баланс сум", "остаток", "остаток средств",
      "депозит", "предоплата",
      "balance", "balance amount", "deposit", "prepaid", "account balance",
    ],
  },
  {
    key: "debt", label: "Долг", required: false, unique: true,
    group: "client", description: "Задолженность клиента",
    aliases: [
      "долг", "задолженность", "долг клиента", "к оплате", "не оплачено",
      "debt", "outstanding", "owed", "amount due", "unpaid",
    ],
  },
  {
    key: "trainer", label: "Тренер", required: false, unique: true,
    group: "client", description: "Имя тренера / инструктора",
    aliases: [
      "тренер", "инструктор", "тренер клиента", "персональный тренер",
      "trainer", "coach", "instructor", "personal trainer",
    ],
  },

  // ── Subscription ──────────────────────────────────────────────────────────
  {
    key: "membership_name", label: "Абонемент", required: false, unique: true,
    group: "subscription", description: "Название типа абонемента",
    aliases: [
      "абонемент", "тип абонемента", "название абонемента", "тариф", "пакет", "карта",
      "тип карты", "подписка", "услуга", "программа",
      "membership", "plan", "subscription", "package", "pass", "service",
      "program", "ticket", "membership name", "plan name",
    ],
  },
  {
    key: "sub_status", label: "Статус", required: false, unique: true,
    group: "subscription", description: "активен / просрочен / заморожен",
    aliases: [
      "статус", "статус абонемента", "состояние", "состояние абонемента",
      "status", "subscription status", "membership status", "state",
    ],
  },
  {
    key: "sub_start", label: "Дата начала", required: false, unique: true,
    group: "subscription", description: "Дата начала абонемента",
    aliases: [
      "дата начала", "начало", "начало абонемента", "дата активации", "активация",
      "дата открытия", "открыт", "действует с",
      "start date", "start", "activation date", "begins", "valid from", "date start",
    ],
  },
  {
    key: "sub_end", label: "Дата окончания", required: false, unique: true,
    group: "subscription", description: "Дата окончания абонемента",
    aliases: [
      "дата окончания", "окончание", "действует до", "истекает", "до",
      "дата закрытия", "дата истечения", "закрыт",
      "end date", "end", "expires", "expiry", "expiration", "until", "valid until",
      "valid to", "date end",
    ],
  },
  {
    key: "visits_total", label: "Посещений осталось", required: false, unique: true,
    group: "subscription", description: "Количество оставшихся посещений",
    aliases: [
      "посещений осталось", "осталось посещений", "остаток посещений",
      "кол-во посещений", "количество посещений", "посещения", "визиты",
      "visits left", "visits remaining", "remaining visits", "classes left",
      "sessions left", "занятий осталось",
    ],
  },
  {
    key: "last_visit", label: "Последнее посещение", required: false, unique: true,
    group: "subscription", description: "Дата последнего визита клиента",
    aliases: [
      "последнее посещение", "дата последнего посещения", "последний визит",
      "дата последнего визита", "был последний раз", "последняя тренировка",
      "last visit", "last visit date", "last check-in", "last checkin", "last seen",
    ],
  },
]

// ── System field patterns (lock badge, no mapping) ────────────────────────────

const SYSTEM_PATTERNS: RegExp[] = [
  /^(id|uid|uuid|guid|pk|primary\s*key)$/i,
  /^(created.?at|updated.?at|modified.?at|deleted.?at)$/i,
  /^(club.?id|tenant.?id|org.?id|organization.?id)$/i,
  /^(qr.?token|qr.?code|qr)$/i,
  /^(telegram.?id|tg.?id|chat.?id)$/i,
  /^(дата\s+создания|дата\s+изменения|дата\s+регистрации\s+в\s+системе)$/i,
  /^(row.?id|row.?number|seq|index|#|№|no\.?)$/i,
]

// ── Computed field patterns (gear badge, no mapping) ──────────────────────────

const COMPUTED_PATTERNS: RegExp[] = [
  // last visit is now an IMPORTABLE field (see CLIENT_FIELDS) — not computed
  /^(next.?visit|следующее\s+посещение)$/i,
  /^(visit.?count|total.?visits|кол.?во\s+посещений|количество\s+всех\s+посещений)$/i,
  /^(last.?payment|последняя\s+оплата|дата\s+оплаты)$/i,
  /^(activity|активность\s+клиента)$/i,
  /^(статус\s+клиента|client.?status)$/i,
  /^(days?.?left|осталось\s+дней)$/i,
]

// ── Column blacklist (prevents auto-assignment even if score matches) ──────────

const COL_BLACKLIST: RegExp[] = [
  /^(id|uid|uuid|#|№|no\.?|seq|row|index)$/i,
  /^(номер\s*п\.?\s*п\.?|n\/?n|nn)$/i,
]

// ── Public: getColCategory ────────────────────────────────────────────────────

export function getColCategory(colName: string): ColCategory {
  const n = colName.trim()
  if (SYSTEM_PATTERNS.some((p) => p.test(n))) return "system"
  if (COMPUTED_PATTERNS.some((p) => p.test(n))) return "computed"
  return "importable"
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-:.()\[\]{}/\\,;!?*&#@$%^"'`|~«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ── Name-based scoring ────────────────────────────────────────────────────────

function scoreByName(field: ImportFieldDef, colNorm: string): number {
  // Exact label
  if (normalize(field.label) === colNorm) return 100
  // Exact alias
  for (const alias of field.aliases) {
    if (normalize(alias) === colNorm) return 95
  }
  // Contains
  let best = 0
  for (const alias of field.aliases) {
    const an = normalize(alias)
    if (an.length < 3) continue
    if (colNorm === an) { best = Math.max(best, 95); continue }
    if (colNorm.includes(an) || an.includes(colNorm)) {
      const ratio = Math.min(colNorm.length, an.length) / Math.max(colNorm.length, an.length)
      best = Math.max(best, Math.round(62 + ratio * 28))
    }
  }
  if (best >= 62) return best
  // Word overlap
  const colWords = colNorm.split(" ").filter((w) => w.length >= 3)
  if (!colWords.length) return 0
  const aliasWords = new Set(
    field.aliases.flatMap((a) => normalize(a).split(" ").filter((w) => w.length >= 3))
  )
  const hits = colWords.filter(
    (w) => aliasWords.has(w) || [...aliasWords].some((aw) => aw.startsWith(w) || w.startsWith(aw))
  ).length
  return hits > 0 ? Math.round(35 + (hits / colWords.length) * 22) : 0
}

// ── Content-based scoring ─────────────────────────────────────────────────────

const PHONE_RE   = /^\+?[\d\s()\-]{7,16}$/
const EMAIL_RE   = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/
const DATE_RE    = /^\d{1,4}[.\-/]\d{1,2}[.\-/]\d{1,4}$/
const INT_RE     = /^\d+$/

const GENDER_SET = new Set(["м","ж","м.","ж.","male","female","мужской","женский","m","f","муж","жен","man","woman","мужчина","женщина"])
const STATUS_SET = new Set(["активен","просрочен","заморожен","отменён","cancelled","истёк","истек","active","expired","frozen","inactive","pending"])

function scoreByContent(key: FieldKey, s: string[]): number {
  const n = s.length
  if (n < 2) return 0

  switch (key) {
    case "phone": {
      const h = s.filter((v) => PHONE_RE.test(v) && /\d{7,}/.test(v)).length
      return h / n >= 0.6 ? Math.round(52 + (h / n) * 36) : 0
    }
    case "email": {
      const h = s.filter((v) => EMAIL_RE.test(v)).length
      return h / n >= 0.3 ? Math.round(55 + (h / n) * 30) : 0
    }
    case "gender": {
      const h = s.filter((v) => GENDER_SET.has(v.toLowerCase())).length
      return h / n >= 0.6 ? Math.round(65 + (h / n) * 23) : 0
    }
    case "sub_status": {
      const h = s.filter((v) => STATUS_SET.has(v.toLowerCase())).length
      return h / n >= 0.4 ? Math.round(58 + (h / n) * 28) : 0
    }
    case "birth_date": {
      const h = s.filter((v) => DATE_RE.test(v)).length
      if (h / n < 0.5) return 0
      const years = s.map((v) => { const m = v.match(/\b(19|20)\d{2}\b/); return m ? parseInt(m[0]) : 0 }).filter(Boolean)
      if (!years.length) return 0
      const avg = years.reduce((a, b) => a + b, 0) / years.length
      return avg < new Date().getFullYear() - 12 ? Math.round(55 + (h / n) * 18) : 0
    }
    case "sub_start": {
      const h = s.filter((v) => DATE_RE.test(v)).length
      if (h / n < 0.5) return 0
      const years = s.map((v) => { const m = v.match(/\b20\d{2}\b/); return m ? parseInt(m[0]) : 0 }).filter(Boolean)
      if (!years.length) return 0
      const avg = years.reduce((a, b) => a + b, 0) / years.length
      const now = new Date().getFullYear()
      return avg >= now - 5 && avg <= now ? 46 : 0
    }
    case "sub_end": {
      const h = s.filter((v) => DATE_RE.test(v)).length
      if (h / n < 0.5) return 0
      const years = s.map((v) => { const m = v.match(/\b20\d{2}\b/); return m ? parseInt(m[0]) : 0 }).filter(Boolean)
      if (!years.length) return 0
      const avg = years.reduce((a, b) => a + b, 0) / years.length
      const now = new Date().getFullYear()
      return avg >= now - 2 && avg <= now + 10 ? 52 : 0
    }
    case "last_visit": {
      const h = s.filter((v) => DATE_RE.test(v) || /\d{4}-\d{2}-\d{2}/.test(v)).length
      if (h / n < 0.5) return 0
      const years = s.map((v) => { const m = v.match(/\b20\d{2}\b/); return m ? parseInt(m[0]) : 0 }).filter(Boolean)
      if (!years.length) return 0
      const avg = years.reduce((a, b) => a + b, 0) / years.length
      const now = new Date().getFullYear()
      return avg >= now - 3 && avg <= now ? 44 : 0
    }
    case "balance": {
      const nums = s.map((v) => parseFloat(v.replace(/\s/g, "").replace(",", "."))).filter((n) => !isNaN(n))
      if (nums.length / n < 0.6) return 0
      return nums.reduce((a, b) => a + b, 0) / nums.length > 500 ? 55 : 0
    }
    case "debt": {
      const nums = s.map((v) => parseFloat(v.replace(/\s/g, "").replace(",", "."))).filter((n) => !isNaN(n))
      if (nums.length / n < 0.6) return 0
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      return avg > 0 && avg < 10_000_000 ? 38 : 0  // low confidence — needs name hint
    }
    case "visits_total": {
      const nums = s.map((v) => parseFloat(v)).filter((n) => !isNaN(n))
      if (nums.length / n < 0.6) return 0
      if (!nums.every((n) => INT_RE.test(String(n)))) return 0
      const max = Math.max(...nums)
      return max <= 200 ? 54 : 0
    }
    case "membership_name": {
      const nonNum  = s.filter((v) => !/^[\d.,\s]+$/.test(v))
      const nonDate = s.filter((v) => !DATE_RE.test(v))
      const nonStat = s.filter((v) => !STATUS_SET.has(v.toLowerCase()))
      const unique  = new Set(s.map((v) => v.toLowerCase()))
      const avgLen  = s.reduce((a, b) => a + b.length, 0) / n
      return nonNum.length / n >= 0.85 && nonDate.length / n >= 0.9 &&
             nonStat.length / n >= 0.9 && unique.size >= 2 && unique.size <= 20 &&
             avgLen >= 2 && avgLen <= 50 ? 42 : 0
    }
    case "first_name": {
      // Mostly single short words, letters only
      const singleWords = s.filter((v) => /^[а-яёa-z\-']{2,25}$/i.test(v.trim())).length
      return singleWords / n >= 0.7 ? 30 : 0  // low — only as tiebreaker
    }
    case "full_name": {
      // Multi-word strings with spaces = likely full names
      const multiWord = s.filter((v) => v.trim().split(/\s+/).length >= 2).length
      return multiWord / n >= 0.6 ? 38 : 0
    }
    case "trainer": {
      // Names with spaces (person names)
      const namelike = s.filter((v) => /^[а-яёa-z\s\-']{4,40}$/i.test(v.trim()) && v.trim().split(/\s+/).length >= 2).length
      return namelike / n >= 0.5 ? 28 : 0
    }
    default:
      return 0
  }
}

// ── Main scoring ──────────────────────────────────────────────────────────────

function computeScore(field: ImportFieldDef, colNorm: string, samples: string[]): number {
  const ns = scoreByName(field, colNorm)
  const cs = samples.length >= 2 ? scoreByContent(field.key, samples) : 0

  if (ns >= 90) return Math.min(100, ns)
  if (ns >= 62) return Math.min(100, ns + (cs > 65 ? 5 : 0))
  if (ns >= 35) return Math.min(100, ns + (cs > 60 ? 8 : 0))
  return cs > 0 ? Math.round(cs * 0.9) : ns
}

// ── Public: detectColumn ──────────────────────────────────────────────────────

export function detectColumn(colName: string, samples: string[] = []): DetectionResult | null {
  const colNorm     = normalize(colName)
  const blacklisted = COL_BLACKLIST.some((p) => p.test(colName.trim()))

  const scored = CLIENT_FIELDS
    .map((field) => {
      let score = computeScore(field, colNorm, samples.filter(Boolean))
      if (blacklisted) score = Math.min(score, 4)
      return { key: field.key, score }
    })
    .sort((a, b) => b.score - a.score)

  const winner   = scored[0]
  const runnerUp = scored[1]
  if (!winner || winner.score < 38) return null

  const gap        = winner.score - (runnerUp?.score ?? 0)
  const confidence = gap < 8 ? Math.round(winner.score * 0.82) : winner.score

  const field    = CLIENT_FIELDS.find((f) => f.key === winner.key)!
  const colN     = normalize(colName)
  const labelN   = normalize(field.label)
  let stage: 1 | 2 | 3 | 4 = 4
  if (labelN === colN || field.aliases.some((a) => normalize(a) === colN)) stage = 1
  else if (field.aliases.some((a) => { const an = normalize(a); return an.length >= 3 && (colN.includes(an) || an.includes(colN)) })) stage = 2
  else if (winner.score >= 35 && winner.score < 62) stage = 3

  return { key: winner.key, confidence, stage }
}

// ── Public: buildAutoMapping ──────────────────────────────────────────────────

export function buildAutoMapping(file: ParsedFile): MappingEntry[] {
  const usedUnique = new Set<FieldKey>()

  return file.headers.map((h, ci) => {
    // System/computed columns are never mapped
    if (getColCategory(h) !== "importable") {
      return { fileCol: h, fieldKey: "__skip__" as FieldKey }
    }

    const samples   = file.rows.slice(0, 30).map((row) => String(row[ci] ?? "").trim()).filter(Boolean)
    const detection = detectColumn(h, samples) ?? undefined
    if (!detection) return { fileCol: h, fieldKey: "__skip__" as FieldKey }

    const fieldDef = CLIENT_FIELDS.find((f) => f.key === detection.key)
    if (fieldDef?.unique && usedUnique.has(detection.key)) {
      return { fileCol: h, fieldKey: "__skip__" as FieldKey, detection }
    }

    if (detection.confidence >= 55) {
      if (fieldDef?.unique) usedUnique.add(detection.key)
      return { fileCol: h, fieldKey: detection.key, detection }
    }

    return { fileCol: h, fieldKey: "__skip__" as FieldKey, detection }
  })
}
