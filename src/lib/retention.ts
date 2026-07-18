import type { ClientRow } from "@/lib/clients"

export type RetentionReason = "expiring" | "inactive" | "debt" | "expired" | "frozen"
export type RetentionLevel = "critical" | "high" | "medium"

export type RetentionCandidate = {
  id: string
  name: string
  phone: string | null
  membership: string | null
  source: string | null
  status: ClientRow["status"]
  daysLeft: number | null
  lastVisit: string | null
  inactiveDays: number | null
  debt: number
  score: number
  level: RetentionLevel
  reasons: RetentionReason[]
  estimatedValue: number
  recommendedAction: string
}

export type RetentionSummary = {
  atRisk: number
  critical: number
  inactive14: number
  expiring7: number
  revenueAtRisk: number
}

export type RetentionData = {
  candidates: RetentionCandidate[]
  summary: RetentionSummary
}

const DAY_MS = 86_400_000

function daysAgo(value: string | null, now: Date): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS))
}

function expiredDays(row: ClientRow, now: Date): number | null {
  if (!row.expiresAt) return null
  const timestamp = new Date(`${row.expiresAt}T00:00:00`).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS))
}

function levelFor(score: number): RetentionLevel {
  if (score >= 70) return "critical"
  if (score >= 45) return "high"
  return "medium"
}

function actionFor(reasons: RetentionReason[]): string {
  if (reasons.includes("debt")) return "Уточнить оплату и предложить удобный способ погашения"
  if (reasons.includes("expired")) return "Связаться и предложить персональное возвращение"
  if (reasons.includes("expiring")) return "Предложить продление до окончания абонемента"
  if (reasons.includes("inactive")) return "Уточнить причину паузы и помочь вернуться к тренировкам"
  return "Обсудить возвращение после заморозки"
}

export function buildRetentionData(
  rows: ClientRow[],
  membershipPrices: Record<string, number>,
  now = new Date(),
): RetentionData {
  const candidates = rows.flatMap<RetentionCandidate>((row) => {
    const reasons: RetentionReason[] = []
    const inactiveDays = daysAgo(row.lastVisit, now)
    let score = 0

    if (row.status === "active" && row.daysLeft !== null && row.daysLeft >= 0) {
      if (row.daysLeft <= 3) {
        score += 50
        reasons.push("expiring")
      } else if (row.daysLeft <= 7) {
        score += 35
        reasons.push("expiring")
      } else if (row.daysLeft <= 14) {
        score += 20
        reasons.push("expiring")
      }
    }

    if (row.status === "active") {
      if (inactiveDays === null) {
        score += 35
        reasons.push("inactive")
      } else if (inactiveDays >= 30) {
        score += 45
        reasons.push("inactive")
      } else if (inactiveDays >= 14) {
        score += 30
        reasons.push("inactive")
      }
    }

    if (row.debt > 0) {
      score += 35
      reasons.push("debt")
    }

    if (row.status === "expired") {
      const sinceExpiry = expiredDays(row, now)
      if (sinceExpiry !== null && sinceExpiry <= 30) {
        score += 45
        reasons.push("expired")
      } else if (sinceExpiry !== null && sinceExpiry <= 90) {
        score += 25
        reasons.push("expired")
      }
    }

    if (row.status === "frozen") {
      score += 20
      reasons.push("frozen")
    }

    if (score < 20 || reasons.length === 0) return []

    return [{
      id: row.id,
      name: row.name,
      phone: row.phone,
      membership: row.membership,
      source: row.source,
      status: row.status,
      daysLeft: row.daysLeft,
      lastVisit: row.lastVisit,
      inactiveDays,
      debt: row.debt,
      score: Math.min(100, score),
      level: levelFor(score),
      reasons,
      estimatedValue: row.membership ? Number(membershipPrices[row.membership] ?? 0) : 0,
      recommendedAction: actionFor(reasons),
    }]
  }).sort((a, b) => b.score - a.score || b.estimatedValue - a.estimatedValue || a.name.localeCompare(b.name, "ru"))

  return {
    candidates,
    summary: {
      atRisk: candidates.length,
      critical: candidates.filter((item) => item.level === "critical").length,
      inactive14: candidates.filter((item) => item.reasons.includes("inactive") && (item.inactiveDays === null || item.inactiveDays >= 14)).length,
      expiring7: candidates.filter((item) => item.reasons.includes("expiring") && item.daysLeft !== null && item.daysLeft <= 7).length,
      revenueAtRisk: candidates.reduce((sum, item) => sum + item.estimatedValue, 0),
    },
  }
}
