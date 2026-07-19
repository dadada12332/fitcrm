import type { DashboardData } from "@/lib/dashboard"
import type { RetentionCandidate, RetentionData } from "@/lib/retention"

export type GrowthPriority = "critical" | "high" | "medium"

export type GrowthAction = {
  id: string
  title: string
  description: string
  count: number
  value: number
  priority: GrowthPriority
  href: string
}

export type GrowthPools = {
  renewalCount: number
  renewalValue: number
  winBackCount: number
  winBackValue: number
  debtCount: number
  debtValue: number
  activeClients: number
  averageTicket: number
}

export type GrowthScenario = {
  renewalRate: number
  winBackRate: number
  debtCollectionRate: number
  referralsPer100: number
}

export type GrowthImpact = {
  renewals: number
  winBack: number
  debtCollection: number
  referrals: number
  total: number
  recoveredClients: number
}

export type GrowthPlaybook = {
  id: "renewal" | "comeback" | "debt" | "onboarding"
  title: string
  trigger: string
  audience: number
  channel: string
  message: string
}

export type GrowthExperiment = {
  id: string
  title: string
  hypothesis: string
  metric: string
  durationDays: number
  expectedImpact: string
  playbookId: GrowthPlaybook["id"]
}

export type GrowthData = {
  health: { score: number; label: string; explanation: string }
  metrics: {
    revenue30: number
    revenueTrendPct: number
    attendanceTrendPct: number
    activeClients: number
    retentionValue: number
  }
  dailyPlan: GrowthAction[]
  pools: GrowthPools
  playbooks: GrowthPlaybook[]
  experiments: GrowthExperiment[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function sumEstimated(candidates: RetentionCandidate[], predicate: (candidate: RetentionCandidate) => boolean) {
  return candidates.filter(predicate).reduce((sum, candidate) => sum + candidate.estimatedValue, 0)
}

export function calculateGrowthImpact(pools: GrowthPools, scenario: GrowthScenario): GrowthImpact {
  const renewalRate = clamp(scenario.renewalRate, 0, 100) / 100
  const winBackRate = clamp(scenario.winBackRate, 0, 100) / 100
  const debtRate = clamp(scenario.debtCollectionRate, 0, 100) / 100
  const referralsPer100 = clamp(scenario.referralsPer100, 0, 100)

  const renewals = Math.round(pools.renewalValue * renewalRate)
  const winBack = Math.round(pools.winBackValue * winBackRate)
  const debtCollection = Math.round(pools.debtValue * debtRate)
  const referrals = Math.round((pools.activeClients * referralsPer100 / 100) * pools.averageTicket)
  const recoveredClients = Math.round(
    pools.renewalCount * renewalRate + pools.winBackCount * winBackRate + pools.activeClients * referralsPer100 / 100,
  )

  return { renewals, winBack, debtCollection, referrals, total: renewals + winBack + debtCollection + referrals, recoveredClients }
}

export function buildGrowthData(dashboard: DashboardData, retention: RetentionData): GrowthData {
  const candidates = retention.candidates
  const activeClients = dashboard.activeClients
  const revenue30 = dashboard.periods["30Д"]
  const revenueTrendPct = percentChange(revenue30.revenue, revenue30.prevRevenue)
  const riskRatio = activeClients > 0 ? retention.summary.atRisk / activeClients : retention.summary.atRisk > 0 ? 1 : 0
  const debtRatio = activeClients > 0 ? dashboard.debtCount / activeClients : dashboard.debtCount > 0 ? 1 : 0
  const healthScore = clamp(Math.round(
    100
    - Math.min(35, riskRatio * 40)
    - Math.min(20, debtRatio * 25)
    - Math.min(20, Math.max(0, -dashboard.attendanceChangePct) * 0.5)
    - Math.min(15, Math.max(0, -revenueTrendPct) * 0.3),
  ), 0, 100)
  const healthLabel = healthScore >= 80 ? "Сильная форма" : healthScore >= 60 ? "Нужен фокус" : "Требует действий"
  const healthExplanation = healthScore >= 80
    ? "Основные сигналы стабильны — можно ускорять эксперименты роста."
    : healthScore >= 60
      ? "Есть заметные точки потери выручки, но их можно обработать текущей командой."
      : "Риски удержания, долги или динамика требуют ежедневного контроля."

  const expiring = candidates.filter((candidate) => candidate.reasons.includes("expiring"))
  const winBack = candidates.filter((candidate) => candidate.reasons.includes("expired") || (candidate.reasons.includes("inactive") && !candidate.reasons.includes("expiring")))
  const debtCandidates = candidates.filter((candidate) => candidate.reasons.includes("debt"))
  const dailyPlan: GrowthAction[] = []

  if (retention.summary.critical > 0) dailyPlan.push({ id: "critical", title: "Разобрать критические риски", description: "Начните с клиентов, у которых совпало несколько сигналов оттока.", count: retention.summary.critical, value: sumEstimated(candidates, (candidate) => candidate.level === "critical"), priority: "critical", href: "/retention" })
  if (expiring.length > 0) dailyPlan.push({ id: "renewals", title: "Закрыть продления до истечения", description: "Связаться до окончания абонемента и предложить удобный сценарий продления.", count: expiring.length, value: sumEstimated(expiring, () => true), priority: "high", href: "/retention" })
  if (winBack.length > 0) dailyPlan.push({ id: "winback", title: "Запустить возврат клиентов", description: "Выяснить причину паузы и предложить персональный путь возвращения.", count: winBack.length, value: sumEstimated(winBack, () => true), priority: "high", href: "/retention" })
  if (dashboard.debtCount > 0) dailyPlan.push({ id: "debts", title: "Вернуть задолженность", description: "Сначала обработать долги с понятным способом и сроком оплаты.", count: dashboard.debtCount, value: dashboard.debtTotal, priority: "medium", href: "/clients?status=debt" })
  if (dashboard.todayNewClients > 0) dailyPlan.push({ id: "onboarding", title: "Активировать новых клиентов", description: "Помочь сделать первые три посещения — это формирует привычку и снижает ранний отток.", count: dashboard.todayNewClients, value: 0, priority: "medium", href: "/clients" })
  if (dailyPlan.length === 0) dailyPlan.push({ id: "experiment", title: "Запустить один growth-эксперимент", description: "Критических потерь не видно — используйте свободный ресурс команды для контролируемого теста роста.", count: 1, value: 0, priority: "medium", href: "#experiments" })

  const pricedCandidates = candidates.filter((candidate) => candidate.estimatedValue > 0)
  const averageTicket = pricedCandidates.length > 0
    ? Math.round(pricedCandidates.reduce((sum, candidate) => sum + candidate.estimatedValue, 0) / pricedCandidates.length)
    : revenue30.revenue > 0 && activeClients > 0 ? Math.round(revenue30.revenue / activeClients) : 0
  const pools: GrowthPools = {
    renewalCount: expiring.length,
    renewalValue: sumEstimated(expiring, () => true),
    winBackCount: winBack.length,
    winBackValue: sumEstimated(winBack, () => true),
    debtCount: debtCandidates.length || dashboard.debtCount,
    debtValue: dashboard.debtTotal,
    activeClients,
    averageTicket,
  }
  const playbooks: GrowthPlaybook[] = [
    { id: "renewal", title: "Продление до дедлайна", trigger: "Абонемент заканчивается в течение 7 дней", audience: expiring.length, channel: "Telegram / звонок", message: "Здравствуйте! Ваш абонемент скоро заканчивается. Давайте заранее подберём удобное продление, чтобы тренировки продолжились без паузы. Ответьте на это сообщение — поможем выбрать вариант." },
    { id: "comeback", title: "Мягкое возвращение", trigger: "Нет посещений 14+ дней или абонемент недавно истёк", audience: winBack.length, channel: "Telegram", message: "Здравствуйте! Давно не виделись. Всё ли в порядке с тренировками? Если график или программа перестали подходить, напишите — поможем составить простой план возвращения без давления." },
    { id: "debt", title: "Оплата без конфликта", trigger: "Есть задолженность", audience: dashboard.debtCount, channel: "Telegram / звонок", message: "Здравствуйте! Напоминаем об оплате по абонементу. Если сейчас неудобно оплатить полностью, свяжитесь с нами — вместе найдём понятный вариант и срок." },
    { id: "onboarding", title: "Первые три посещения", trigger: "Новый клиент ещё не сформировал привычку", audience: dashboard.todayNewClients, channel: "Telegram", message: "Добро пожаловать! Самое важное сейчас — спокойно войти в ритм. Давайте сразу выберем три удобных времени для первых тренировок. Если нужна помощь тренера, просто ответьте на сообщение." },
  ]
  const experiments: GrowthExperiment[] = [
    { id: "48h-renewal", title: "Окно продления 48 часов", hypothesis: "Личное предложение до окончания абонемента увеличит долю продлений без скидки.", metric: "Конверсия в продление", durationDays: 14, expectedImpact: "+10–20% к продлениям", playbookId: "renewal" },
    { id: "three-visits", title: "Первые 3 визита", hypothesis: "Клиент, заранее выбравший первые три тренировки, быстрее формирует привычку.", metric: "Доля с 3 визитами за 14 дней", durationDays: 21, expectedImpact: "Снижение раннего оттока", playbookId: "onboarding" },
    { id: "human-comeback", title: "Возврат без скидки", hypothesis: "Вопрос о причине паузы работает лучше массового промокода.", metric: "Вернувшиеся за 14 дней", durationDays: 14, expectedImpact: "+5–12% win-back", playbookId: "comeback" },
    { id: "debt-choice", title: "Выбор способа оплаты", hypothesis: "Предложение двух понятных вариантов снижает игнорирование задолженности.", metric: "Собранная задолженность", durationDays: 10, expectedImpact: "+10% к collection rate", playbookId: "debt" },
    { id: "member-referral", title: "Приведи партнёра", hypothesis: "Совместная тренировка мотивирует действующих клиентов сильнее денежной скидки.", metric: "Новые клиенты по рекомендации", durationDays: 30, expectedImpact: "1–3 лида на 100 клиентов", playbookId: "onboarding" },
  ]

  return {
    health: { score: healthScore, label: healthLabel, explanation: healthExplanation },
    metrics: { revenue30: revenue30.revenue, revenueTrendPct, attendanceTrendPct: dashboard.attendanceChangePct, activeClients, retentionValue: retention.summary.revenueAtRisk + dashboard.debtTotal },
    dailyPlan,
    pools,
    playbooks,
    experiments,
  }
}
