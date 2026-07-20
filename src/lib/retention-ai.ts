import type { RetentionCandidate, RetentionData, RetentionLevel, RetentionReason } from "@/lib/retention"

export type RetentionAiFilter = "all" | RetentionLevel | RetentionReason

export type RetentionAiScope =
  | { kind: "portfolio"; filter: RetentionAiFilter }
  | { kind: "client"; clientId: string }

export type RetentionClientActivity = {
  visits30: number
  previousVisits30: number
  paid180: number
  lastPaymentAt: string | null
  subscriptionsCount: number
}

export type RetentionAiDriver = {
  reason: RetentionReason
  label: string
  count: number
  share: number
  insight: string
}

export type RetentionAiPriority = {
  clientId: string
  name: string
  score: number
  level: RetentionLevel
  reasons: RetentionReason[]
  estimatedValue: number
  facts: string[]
  rationale: string
  nextAction: string
  messageDraft: string
}

export type RetentionAiPlanItem = {
  period: string
  title: string
  description: string
  count: number
  clientIds: string[]
}

export type RetentionAiAnalysis = {
  source: "ai" | "rules"
  generatedAt: string
  scope: RetentionAiScope
  title: string
  summary: string
  confidence: "high" | "medium" | "low"
  confidenceNote: string
  metrics: {
    selected: number
    critical: number
    revenueAtRisk: number
  }
  drivers: RetentionAiDriver[]
  priorities: RetentionAiPriority[]
  plan: RetentionAiPlanItem[]
  caveats: string[]
}

const REASON_LABELS: Record<RetentionReason, string> = {
  expiring: "Скоро истекает",
  inactive: "Снизилась активность",
  debt: "Есть задолженность",
  expired: "Недавно закончился",
  frozen: "Абонемент заморожен",
}

const DRIVER_INSIGHTS: Record<RetentionReason, string> = {
  expiring: "Предложение до даты окончания обычно конвертируется лучше возврата после ухода.",
  inactive: "Пауза в посещениях часто предшествует непродлению, даже если абонемент ещё активен.",
  debt: "Сначала стоит уточнить причину и предложить удобный способ закрыть задолженность.",
  expired: "Первые 30 дней после окончания — наиболее сильное окно для возврата клиента.",
  frozen: "Важно заранее согласовать дату возвращения и снять неопределённость после заморозки.",
}

export function matchesRetentionFilter(candidate: RetentionCandidate, filter: RetentionAiFilter) {
  return filter === "all" || candidate.level === filter || candidate.reasons.includes(filter as RetentionReason)
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} сум`
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Здравствуйте"
}

function draftFor(candidate: RetentionCandidate) {
  const greeting = `Здравствуйте, ${firstName(candidate.name)}!`
  if (candidate.reasons.includes("debt")) {
    return `${greeting} Хотели уточнить по оплате абонемента. Подскажите, пожалуйста, удобно ли вам сейчас продолжить занятия и какой способ оплаты подойдёт?`
  }
  if (candidate.reasons.includes("expired")) {
    return `${greeting} Давно не виделись в клубе. Хотим помочь вам вернуться к тренировкам и подобрать удобный вариант продолжения. Рассказать подробнее?`
  }
  if (candidate.reasons.includes("expiring")) {
    return `${greeting} Ваш абонемент скоро заканчивается. Можем заранее подобрать удобное продление, чтобы занятия продолжились без паузы. Подсказать варианты?`
  }
  if (candidate.reasons.includes("inactive")) {
    return `${greeting} Заметили, что вы давно не были на тренировках. Всё ли в порядке и можем ли мы помочь подобрать удобное время для возвращения?`
  }
  return `${greeting} Хотели уточнить, когда вам будет удобно вернуться к занятиям после заморозки абонемента.`
}

function factsFor(candidate: RetentionCandidate, activity?: RetentionClientActivity) {
  const facts: string[] = []
  if (candidate.daysLeft !== null) facts.push(candidate.daysLeft >= 0 ? `Осталось ${candidate.daysLeft} дн.` : `Истёк ${Math.abs(candidate.daysLeft)} дн. назад`)
  if (candidate.inactiveDays !== null) facts.push(`Без визитов ${candidate.inactiveDays} дн.`)
  else if (candidate.reasons.includes("inactive")) facts.push("Посещений ещё не зафиксировано")
  if (candidate.debt > 0) facts.push(`Долг ${formatMoney(candidate.debt)}`)
  if (activity) {
    facts.push(`Визиты 30 дней: ${activity.visits30}`)
    if (activity.previousVisits30 > 0 || activity.visits30 > 0) facts.push(`Предыдущие 30 дней: ${activity.previousVisits30}`)
    if (activity.paid180 > 0) facts.push(`Оплачено за 180 дней: ${formatMoney(activity.paid180)}`)
  }
  return facts
}

function priorityFor(candidate: RetentionCandidate, activity?: RetentionClientActivity): RetentionAiPriority {
  const trend = activity && activity.previousVisits30 > 0
    ? Math.round(((activity.visits30 - activity.previousVisits30) / activity.previousVisits30) * 100)
    : null
  const rationale = trend !== null && trend < 0
    ? `Посещаемость снизилась на ${Math.abs(trend)}%, одновременно присутствуют сигналы: ${candidate.reasons.map((reason) => REASON_LABELS[reason].toLocaleLowerCase("ru-RU")).join(", ")}.`
    : `Риск ${candidate.score}/100 сформирован сигналами: ${candidate.reasons.map((reason) => REASON_LABELS[reason].toLocaleLowerCase("ru-RU")).join(", ")}.`

  return {
    clientId: candidate.id,
    name: candidate.name,
    score: candidate.score,
    level: candidate.level,
    reasons: candidate.reasons,
    estimatedValue: candidate.estimatedValue,
    facts: factsFor(candidate, activity),
    rationale,
    nextAction: candidate.recommendedAction,
    messageDraft: draftFor(candidate),
  }
}

function buildPlan(candidates: RetentionCandidate[]): RetentionAiPlanItem[] {
  const urgent = candidates.filter((candidate) => candidate.level === "critical").slice(0, 8)
  const renewals = candidates.filter((candidate) => candidate.reasons.includes("expiring") && !urgent.includes(candidate)).slice(0, 10)
  const winBack = candidates.filter((candidate) => (candidate.reasons.includes("inactive") || candidate.reasons.includes("expired")) && !urgent.includes(candidate) && !renewals.includes(candidate)).slice(0, 10)

  return [
    {
      period: "Сегодня",
      title: "Связаться с критическими клиентами",
      description: "Начните с сочетания нескольких рисков и самой высокой потенциальной выручки.",
      count: urgent.length,
      clientIds: urgent.map((candidate) => candidate.id),
    },
    {
      period: "Дни 2–3",
      title: "Закрыть ближайшие продления",
      description: "Предложите подходящий тариф до даты окончания текущего абонемента.",
      count: renewals.length,
      clientIds: renewals.map((candidate) => candidate.id),
    },
    {
      period: "Дни 4–5",
      title: "Вернуть снизивших активность",
      description: "Сначала выясните причину паузы, затем предложите конкретный следующий визит.",
      count: winBack.length,
      clientIds: winBack.map((candidate) => candidate.id),
    },
    {
      period: "Дни 6–7",
      title: "Проверить результат",
      description: "Сверьте ответы, оплаты и новые посещения; повторно свяжитесь только с теми, кто не ответил.",
      count: candidates.length,
      clientIds: candidates.slice(0, 20).map((candidate) => candidate.id),
    },
  ].filter((item) => item.count > 0)
}

export function buildRetentionAiAnalysis(
  data: RetentionData,
  scope: RetentionAiScope,
  activity: Record<string, RetentionClientActivity> = {},
  now = new Date(),
): RetentionAiAnalysis | null {
  const selected = scope.kind === "client"
    ? data.candidates.filter((candidate) => candidate.id === scope.clientId)
    : data.candidates.filter((candidate) => matchesRetentionFilter(candidate, scope.filter))

  if (scope.kind === "client" && selected.length === 0) return null

  const revenueAtRisk = selected.reduce((sum, candidate) => sum + candidate.estimatedValue, 0)
  const critical = selected.filter((candidate) => candidate.level === "critical").length
  const drivers = (Object.keys(REASON_LABELS) as RetentionReason[])
    .map((reason) => {
      const count = selected.filter((candidate) => candidate.reasons.includes(reason)).length
      return {
        reason,
        label: REASON_LABELS[reason],
        count,
        share: selected.length ? Math.round((count / selected.length) * 100) : 0,
        insight: DRIVER_INSIGHTS[reason],
      }
    })
    .filter((driver) => driver.count > 0)
    .sort((a, b) => b.count - a.count)

  const priorities = selected.slice(0, scope.kind === "client" ? 1 : 6).map((candidate) => priorityFor(candidate, activity[candidate.id]))
  const title = scope.kind === "client" ? selected[0].name : "Разбор очереди удержания"
  const summary = selected.length === 0
    ? "В выбранном сегменте сейчас нет клиентов с подтверждёнными сигналами оттока."
    : scope.kind === "client"
      ? `${selected[0].name}: риск ${selected[0].score}/100. Главная задача — ${selected[0].recommendedAction.toLocaleLowerCase("ru-RU")}.`
      : `В сегменте ${selected.length} клиентов, из них ${critical} требуют срочного контакта. Потенциально можно сохранить ${formatMoney(revenueAtRisk)}.`
  const hasActivity = selected.some((candidate) => activity[candidate.id])

  return {
    source: "rules",
    generatedAt: now.toISOString(),
    scope,
    title,
    summary,
    confidence: selected.length === 0 ? "low" : hasActivity ? "high" : "medium",
    confidenceNote: selected.length === 0
      ? "Новых сигналов для анализа нет."
      : hasActivity
        ? "Использованы абонементы, посещения и оплаты из CRM."
        : "Вывод основан на текущем статусе абонемента и последнем визите.",
    metrics: { selected: selected.length, critical, revenueAtRisk },
    drivers,
    priorities,
    plan: scope.kind === "client" ? [] : buildPlan(selected),
    caveats: ["Рекомендации не отправляются клиентам автоматически.", "Черновик сообщения нужно проверить перед отправкой."],
  }
}
