import { describe, expect, it } from "vitest"
import type { DashboardData } from "../../src/lib/dashboard"
import { buildGrowthData, calculateGrowthImpact, type GrowthPools } from "../../src/lib/growth"
import type { RetentionData } from "../../src/lib/retention"

const dashboard: DashboardData = {
  todayRevenue: 0, prevRevenue: 0, activeClients: 100, prevClients: 98, todayVisits: 12, prevVisits: 10,
  expiringCount: 2, churnCount: 1, debtCount: 4, debtTotal: 1_000_000, todayNewClients: 3,
  todayPaymentsCount: 0, birthdaysToday: 0, alertsCount: 3, attendanceChangePct: 10, chartData: [], newClients: [],
  periods: {
    "Сегодня": { revenue: 0, prevRevenue: 0, chart: [], unit: "день" },
    "7Д": { revenue: 0, prevRevenue: 0, chart: [], unit: "неделю" },
    "30Д": { revenue: 12_000_000, prevRevenue: 10_000_000, chart: [], unit: "месяц" },
    "3М": { revenue: 0, prevRevenue: 0, chart: [], unit: "3 мес" },
    "Год": { revenue: 0, prevRevenue: 0, chart: [], unit: "год" },
  },
}

const retention: RetentionData = {
  candidates: [
    { id: "a", name: "A", phone: null, membership: "Стандарт", source: null, status: "active", daysLeft: 3, lastVisit: null, inactiveDays: null, debt: 0, score: 85, level: "critical", reasons: ["expiring", "inactive"], estimatedValue: 500_000, recommendedAction: "Продлить" },
    { id: "b", name: "B", phone: null, membership: "Стандарт", source: null, status: "expired", daysLeft: null, lastVisit: null, inactiveDays: null, debt: 0, score: 45, level: "high", reasons: ["expired"], estimatedValue: 500_000, recommendedAction: "Вернуть" },
  ],
  summary: { atRisk: 2, critical: 1, inactive14: 1, expiring7: 1, revenueAtRisk: 1_000_000 },
}

describe("growth operating system", () => {
  it("builds a prioritized daily plan and opportunity pools", () => {
    const result = buildGrowthData(dashboard, retention)
    expect(result.dailyPlan.map((item) => item.id)).toEqual(["critical", "renewals", "winback", "debts", "onboarding"])
    expect(result.dailyPlan.find((item) => item.id === "winback")).toMatchObject({ destination: "playbooks", playbookId: "comeback" })
    expect(result.dailyPlan.find((item) => item.id === "debts")).toMatchObject({ destination: "playbooks", playbookId: "debt" })
    expect(result.pools.renewalValue).toBe(500_000)
    expect(result.pools.winBackValue).toBe(500_000)
    expect(result.playbooks).toHaveLength(4)
    expect(result.experiments).toHaveLength(5)
  })

  it("reduces the club health score when risk and trends deteriorate", () => {
    const healthy = buildGrowthData(dashboard, retention)
    const weakDashboard = { ...dashboard, attendanceChangePct: -40, debtCount: 50, periods: { ...dashboard.periods, "30Д": { revenue: 5_000_000, prevRevenue: 10_000_000, chart: [], unit: "месяц" } } } satisfies DashboardData
    const weak = buildGrowthData(weakDashboard, { ...retention, summary: { ...retention.summary, atRisk: 70 } })
    expect(healthy.health.score).toBeGreaterThan(weak.health.score)
    expect(weak.health.score).toBeGreaterThanOrEqual(0)
  })

  it("calculates a transparent what-if impact", () => {
    const pools: GrowthPools = { renewalCount: 10, renewalValue: 5_000_000, winBackCount: 10, winBackValue: 5_000_000, debtCount: 5, debtValue: 1_000_000, activeClients: 100, averageTicket: 500_000 }
    expect(calculateGrowthImpact(pools, { renewalRate: 20, winBackRate: 10, debtCollectionRate: 50, referralsPer100: 2 })).toEqual({ renewals: 1_000_000, winBack: 500_000, debtCollection: 500_000, referrals: 1_000_000, total: 3_000_000, recoveredClients: 5 })
  })

  it("clamps unrealistic scenario inputs", () => {
    const pools: GrowthPools = { renewalCount: 1, renewalValue: 100, winBackCount: 0, winBackValue: 0, debtCount: 0, debtValue: 0, activeClients: 0, averageTicket: 0 }
    expect(calculateGrowthImpact(pools, { renewalRate: 300, winBackRate: -10, debtCollectionRate: 0, referralsPer100: 0 }).renewals).toBe(100)
  })
})
