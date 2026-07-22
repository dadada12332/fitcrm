import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getDashboardData } from "@/lib/dashboard"
import { can } from "@/lib/permissions"
import { styleWorkbook } from "@/lib/xlsx"
import { consumeMonthlyLimit } from "@/lib/plan-enforcement"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const club = await getCurrentClub()
  if (!club) return new Response("Club not found", { status: 403 })
  if (!can(club.permissions, "reports", "export")) return new Response("Forbidden", { status: 403 })
  if (!can(club.permissions, "dashboard", "view_finance")) return new Response("Forbidden", { status: 403 })
  const usageError = await consumeMonthlyLimit(club, "exports")
  if (usageError) return new Response(usageError, { status: 429 })

  const d = await getDashboardData(supabase, club.clubId)

  const wb = new ExcelJS.Workbook()
  wb.creator = "FitCRM"
  wb.created = new Date()

  // Лист 1 — Сводка
  const summary = wb.addWorksheet("Сводка")
  summary.columns = [
    { header: "Показатель", key: "metric", width: 36 },
    { header: "Значение", key: "value", width: 22 },
  ]
  summary.getRow(1).font = { bold: true }
  summary.addRows([
    { metric: "Выручка за сегодня", value: d.todayRevenue },
    { metric: "Выручка за вчера", value: d.prevRevenue },
    { metric: "Активные клиенты", value: d.activeClients },
    { metric: "Посещений сегодня", value: d.todayVisits },
    { metric: "Посещений вчера", value: d.prevVisits },
    { metric: "Абонементов истекает (7 дней)", value: d.expiringCount },
    { metric: "Клиентов в зоне риска", value: d.churnCount },
    { metric: "Изменение посещаемости за 7 дней, %", value: Number(d.attendanceChangePct.toFixed(1)) },
  ])

  // Лист 2 — Выручка по дням (30 дней)
  const revenue = wb.addWorksheet("Выручка по дням")
  revenue.columns = [
    { header: "День", key: "day", width: 14 },
    { header: "Выручка", key: "value", width: 22 },
  ]
  revenue.getRow(1).font = { bold: true }
  const now = new Date()
  d.chartData.forEach((point, i) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (d.chartData.length - 1 - i))
    revenue.addRow({
      day: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      value: point.value,
    })
  })

  styleWorkbook(wb)

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fitcrm-dashboard-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
