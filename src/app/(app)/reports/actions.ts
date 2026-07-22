"use server"

import { getCurrentClub } from "@/lib/club"
import { getReportsDataCached, getReportsFinance, getReportsSales, getReportsVisits, getReportsClients, getReportsRenewals, getReportsDebts, getReportsStaff, getReportsAlerts } from "@/lib/reports"
import type { ReportsData, FinanceAgg, SalesAgg, VisitsAgg, ClientsAgg, RenewalsAgg, DebtsAgg, ReportStaffRow, AlertsAgg } from "@/lib/reports"
import { consumeMonthlyLimit, requirePlanFeature } from "@/lib/plan-enforcement"

export async function loadReportsDataAction(): Promise<ReportsData | null> {
  const club = await getCurrentClub()
  if (!club) return null
  if (!club.permissions.reports.view || !club.permissions.reports.export || !club.permissions.reports.finance) return null
  // Кешированные агрегаты (service-role, безопасно — права проверены выше).
  return getReportsDataCached(club.clubId)
}

/** Финансовая агрегация за период (Stage 1 серверной агрегации). */
export async function loadFinanceAction(
  from: string, to: string, prevFrom: string, prevTo: string,
): Promise<FinanceAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsFinance(club.clubId, from, to, prevFrom, prevTo)
}

/** Агрегация продаж за период (Stage 2 серверной агрегации). */
export async function loadSalesAction(from: string, to: string): Promise<SalesAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsSales(club.clubId, from, to)
}

/** Агрегация посещений за период (Stage 3 серверной агрегации). */
export async function loadVisitsAction(
  from: string, to: string, prevFrom: string, prevTo: string,
): Promise<VisitsAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsVisits(club.clubId, from, to, prevFrom, prevTo)
}

/** Агрегация клиентов за период (Stage 4 серверной агрегации). */
export async function loadClientsAction(
  from: string, to: string, prevFrom: string, prevTo: string,
): Promise<ClientsAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsClients(club.clubId, from, to, prevFrom, prevTo)
}

/** Агрегация продлений (Stage 5 серверной агрегации). Не зависит от периода. */
export async function loadRenewalsAction(): Promise<RenewalsAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsRenewals(club.clubId)
}

/** Агрегация долгов (Stage 6 серверной агрегации). Не зависит от периода. */
export async function loadDebtsAction(): Promise<DebtsAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsDebts(club.clubId)
}

/** Агрегация персонала (Stage 7 серверной агрегации). Не зависит от периода. */
export async function loadStaffAction(): Promise<ReportStaffRow[] | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsStaff(club.clubId)
}

/** Агрегация «Внимание» (Stage 8). Период-независимая — для вкладки и бейджа. */
export async function loadAlertsAction(): Promise<AlertsAgg | null> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return null
  return getReportsAlerts(club.clubId)
}

// ── AI-прогноз и рекомендации (Gemini) ──────────────────────────────────────
export type ForecastInput = {
  periodLabel: string
  days: number
  revenue: number
  prevRevenue: number
  payments: number
  avgPerDay: number
  topService: string | null
  peakHour: number | null
  atRisk: number
  expiringSoon: number
  visits: number
  topProvider: string | null
}

export async function getReportsForecastAction(m: ForecastInput): Promise<{ forecast: string; recommendations: string[]; error?: string }> {
  const club = await getCurrentClub()
  if (!club || !club.permissions.reports.view) return { forecast: "", recommendations: [], error: "Нет доступа" }
  const featureError = requirePlanFeature(club, "advanced_reports") ?? requirePlanFeature(club, "ai")
  if (featureError) return { forecast: "", recommendations: [], error: featureError }
  const usageError = await consumeMonthlyLimit(club, "ai_requests")
  if (usageError) return { forecast: "", recommendations: [], error: usageError }
  const key = process.env.GEMINI_API_KEY

  // Детерминированный фолбэк, если нет ключа/ошибка.
  const growth = m.prevRevenue > 0 ? Math.round(((m.revenue - m.prevRevenue) / m.prevRevenue) * 100) : 0
  const projected = Math.round(m.avgPerDay * 30)
  const fallback = {
    forecast: `При текущем темпе (${Math.round(m.avgPerDay).toLocaleString("ru-RU")} сум/день) прогноз выручки на 30 дней — около ${projected.toLocaleString("ru-RU")} сум${growth ? `, динамика к прошлому периоду ${growth > 0 ? "+" : ""}${growth}%.` : "."}`,
    recommendations: [
      m.atRisk > 0 ? `Свяжитесь с ${m.atRisk} клиентами под угрозой оттока — это удержит выручку.` : "Запустите реферальную программу для роста базы.",
      m.expiringSoon > 0 ? `Напомните о продлении ${m.expiringSoon} истекающим абонементам.` : "Предложите апгрейд активным клиентам на более дорогой тариф.",
      m.peakHour != null ? `Усильте персонал в пик ${m.peakHour}:00–${m.peakHour + 1}:00.` : "Проанализируйте загрузку по часам для планирования смен.",
    ].filter(Boolean),
  }
  if (!key) return fallback

  const prompt =
    `Ты — бизнес-аналитик фитнес-клуба «${club.clubName}». Данные за период «${m.periodLabel}» (${m.days} дн.):\n` +
    `- Выручка: ${m.revenue} сум (пред. период: ${m.prevRevenue} сум), платежей: ${m.payments}, средняя/день: ${Math.round(m.avgPerDay)} сум\n` +
    `- Посещений: ${m.visits}${m.peakHour != null ? `, пик в ${m.peakHour}:00` : ""}\n` +
    `- Топ тариф: ${m.topService ?? "—"}, основной способ оплаты: ${m.topProvider ?? "—"}\n` +
    `- Под угрозой оттока: ${m.atRisk}, истекают скоро: ${m.expiringSoon}\n\n` +
    `Верни СТРОГО JSON без markdown: {"forecast":"1-2 предложения прогноза выручки на следующие 30 дней в сумах","recommendations":["3-4 конкретных действия, каждое ≤120 символов, на русском"]}. Валюта — сум.`

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    })
    const data = await res.json()
    if (data.error) return fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text).filter(Boolean).join("").trim()
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""))
    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((r: unknown) => typeof r === "string").slice(0, 5) : fallback.recommendations
    return { forecast: String(parsed.forecast ?? fallback.forecast), recommendations: recs }
  } catch {
    return fallback
  }
}
