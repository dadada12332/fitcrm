import { createServiceClient } from "@/lib/supabase/service"

// ── Справочники ключей (единственное место, где перечислены доступные фичи/лимиты/разделы) ──
export const FEATURE_KEYS = [
  "crm", "reports", "finance", "warehouse", "telegram", "broadcasts",
  "email", "sms", "push", "ai", "knowledge", "import", "export",
  "multi_branch", "instagram", "api", "platform_api", "white_label",
  "retention", "growth", "inbox", "telegram_automation",
  "payment_integrations", "advanced_reports",
] as const
export type FeatureKey = typeof FEATURE_KEYS[number]

export const FEATURE_LABELS: Record<string, string> = {
  crm: "CRM", reports: "Отчёты", finance: "Финансы", warehouse: "Склад",
  telegram: "Telegram", broadcasts: "Рассылки", email: "Email", sms: "SMS",
  push: "Push", ai: "AI", knowledge: "База знаний", import: "Импорт",
  export: "Экспорт", multi_branch: "Мультифилиальность", instagram: "Instagram",
  api: "API", platform_api: "Platform API", white_label: "White Label",
  retention: "Удержание", growth: "Growth OS", inbox: "Поддержка клиентов",
  telegram_automation: "Автоматизация Telegram",
  payment_integrations: "Платёжные интеграции", advanced_reports: "Расширенные отчёты",
}

export const LIMIT_KEYS = [
  "clients", "staff", "branches", "products", "users", "roles", "integrations",
  "ai_requests", "telegram_messages", "sms", "files", "storage_mb",
  "checkins", "imports", "exports",
] as const
export type LimitKey = typeof LIMIT_KEYS[number]

export const LIMIT_LABELS: Record<string, string> = {
  clients: "Клиентов", staff: "Сотрудников", branches: "Филиалов", products: "Товаров",
  users: "Пользователей", roles: "Ролей", integrations: "Интеграций",
  ai_requests: "AI-запросов", telegram_messages: "Telegram-сообщений", sms: "SMS",
  files: "Файлов", storage_mb: "Хранилище (МБ)", checkins: "Чек-инов",
  imports: "Импортов", exports: "Экспортов",
}

export const SECTION_KEYS = [
  "dashboard", "clients", "visits", "payments", "memberships", "schedule",
  "warehouse", "reports", "staff", "integrations", "broadcasts", "ai",
  "knowledge", "settings", "retention", "growth", "inbox",
] as const
export type SectionKey = typeof SECTION_KEYS[number]

export const SECTION_LABELS: Record<string, string> = {
  dashboard: "Дашборд", clients: "Клиенты", visits: "Посещения", payments: "Оплаты",
  memberships: "Абонементы", schedule: "Расписание", warehouse: "Склад",
  reports: "Отчёты", staff: "Сотрудники", integrations: "Интеграции",
  broadcasts: "Рассылки", ai: "AI", knowledge: "База знаний", settings: "Настройки",
  retention: "Удержание", growth: "Growth OS", inbox: "Поддержка клиентов",
}

export const PERIOD_LABELS: Record<string, string> = {
  monthly: "Месяц", quarterly: "Квартал", yearly: "Год",
}

// ── Типы ───────────────────────────────────────────────────────
export type PlanRow = {
  id: string
  code: string
  name: string
  slug: string
  description: string
  short_description: string
  color: string
  icon: string
  sort_order: number
  is_popular: boolean
  is_recommended: boolean
  is_active: boolean
  is_archived: boolean
  is_trial: boolean
  trial_days: number
  price: number
  old_price: number | null
  discount_percent: number | null
  currency: string
  period: string
  landing_subtitle: string
  landing_benefits: string[]
  landing_cta: string
  created_at: string
  updated_at: string
}

export type FullPlan = PlanRow & {
  features: Record<string, boolean>
  limits: Record<string, number | null>
  sections: Record<string, boolean>
  clubCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePlan(p: any, features: any[], limits: any[], sections: any[], clubCount: number): FullPlan {
  const f: Record<string, boolean> = {}
  for (const x of features) f[x.feature_key] = !!x.enabled
  const l: Record<string, number | null> = {}
  for (const x of limits) l[x.limit_key] = x.limit_value === null ? null : Number(x.limit_value)
  const s: Record<string, boolean> = {}
  for (const x of sections) s[x.section_key] = !!x.enabled
  return {
    ...p,
    price: Number(p.price),
    old_price: p.old_price === null ? null : Number(p.old_price),
    landing_benefits: Array.isArray(p.landing_benefits) ? p.landing_benefits : [],
    features: f, limits: l, sections: s, clubCount,
  }
}

async function loadPlans(includeArchived: boolean): Promise<FullPlan[]> {
  // Устойчивость к сборке без env (статический пререндер лендинга): не роняем билд.
  let s: ReturnType<typeof createServiceClient>
  try { s = createServiceClient() } catch { return [] }
  let q = s.from("plans").select("*").order("sort_order")
  // Публичный список (лендинг/CRM-карточки) — только активные и не архивные.
  // Admin (includeArchived) видит всё, включая черновики и архив.
  if (!includeArchived) q = q.eq("is_archived", false).eq("is_active", true)
  const { data: plans } = await q
  if (!plans?.length) return []
  const ids = plans.map((p) => p.id)
  const [featRes, limRes, secRes, clubRes] = await Promise.all([
    s.from("plan_features").select("plan_id, feature_key, enabled").in("plan_id", ids),
    s.from("plan_limits").select("plan_id, limit_key, limit_value").in("plan_id", ids),
    s.from("plan_sections").select("plan_id, section_key, enabled").in("plan_id", ids),
    s.from("clubs").select("plan_id").in("plan_id", ids),
  ])
  const byPlan = <T extends { plan_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) { const a = m.get(r.plan_id) ?? []; a.push(r); m.set(r.plan_id, a) }
    return m
  }
  const fm = byPlan(featRes.data), lm = byPlan(limRes.data), sm = byPlan(secRes.data)
  const clubCounts = new Map<string, number>()
  for (const c of (clubRes.data ?? []) as { plan_id: string | null }[]) {
    if (c.plan_id) clubCounts.set(c.plan_id, (clubCounts.get(c.plan_id) ?? 0) + 1)
  }
  return plans.map((p) => normalizePlan(p, fm.get(p.id) ?? [], lm.get(p.id) ?? [], sm.get(p.id) ?? [], clubCounts.get(p.id) ?? 0))
}

/**
 * Все тарифы (свежие данные, без дата-кеша).
 * Тарифы читаются нечасто, поэтому кеш ни к чему; зато изменения из Platform Admin
 * применяются немедленно (лендинг — ISR-страница, сбрасывается revalidatePath при сохранении).
 */
export async function getPlans(opts: { includeArchived?: boolean } = {}): Promise<FullPlan[]> {
  return loadPlans(opts.includeArchived ?? false)
}

/** Тариф по коду (например, для CRM клуба). */
export async function getPlanByCode(code: string): Promise<FullPlan | null> {
  const plans = await loadPlans(true)
  return plans.find((p) => p.code === code) ?? null
}

/** Лёгкая конфигурация доступа для CRM: один точечный запрос, без подсчёта клубов. */
export async function getPlanAccessByCode(code: string): Promise<Pick<FullPlan, "code" | "name" | "features" | "limits" | "sections"> | null> {
  if (!code) return null
  let service: ReturnType<typeof createServiceClient>
  try { service = createServiceClient() } catch { return null }
  const { data, error } = await service.from("plans").select(`
    code, name,
    plan_features(feature_key, enabled),
    plan_limits(limit_key, limit_value),
    plan_sections(section_key, enabled)
  `).eq("code", code).maybeSingle()
  if (error || !data) return null
  const features: Record<string, boolean> = {}
  const limits: Record<string, number | null> = {}
  const sections: Record<string, boolean> = {}
  for (const item of data.plan_features ?? []) features[item.feature_key] = item.enabled === true
  for (const item of data.plan_limits ?? []) limits[item.limit_key] = item.limit_value === null ? null : Number(item.limit_value)
  for (const item of data.plan_sections ?? []) sections[item.section_key] = item.enabled === true
  return { code: data.code, name: data.name, features, limits, sections }
}

/** Список преимуществ тарифа для карточек (лендинг + CRM): из поля лендинга или авто из лимитов/фич. */
export function planBenefits(p: FullPlan): string[] {
  if (p.landing_benefits.length) return p.landing_benefits
  const auto: string[] = []
  const cl = p.limits.clients
  auto.push(cl == null ? "Клиенты без ограничений" : `До ${cl.toLocaleString("ru-RU")} клиентов`)
  const st = p.limits.staff
  if (st != null) auto.push(`${st} сотрудников`)
  const br = p.limits.branches
  if (br != null && br > 1) auto.push("Мультифилиальность")
  const feats = Object.entries(p.features).filter(([, on]) => on).map(([k]) => FEATURE_LABELS[k] ?? k)
  for (const f of feats.slice(0, 4)) if (!auto.includes(f)) auto.push(f)
  return auto.slice(0, 6)
}

/** Быстрые хелперы поверх тарифа клуба (для будущего enforcement). */
export function planHasFeature(plan: FullPlan | null, key: FeatureKey): boolean {
  return plan?.features[key] === true
}
export function planHasSection(plan: FullPlan | null, key: SectionKey): boolean {
  return plan?.sections[key] === true
}
/** Лимит тарифа: число или null (безлимит). undefined-ключ трактуем как безлимит. */
export function planLimit(plan: FullPlan | null, key: LimitKey): number | null {
  if (!plan) return null
  return plan.limits[key] ?? null
}

/** Быстрая карта code → {name, price, currency, period} — замена хардкоду PLAN_PRICES/PLAN_LABELS. */
export async function getPlansMap(): Promise<Record<string, { name: string; price: number; currency: string; period: string }>> {
  const plans = await getPlans({ includeArchived: true })
  const m: Record<string, { name: string; price: number; currency: string; period: string }> = {}
  for (const p of plans) m[p.code] = { name: p.name, price: p.price, currency: p.currency, period: p.period }
  return m
}
