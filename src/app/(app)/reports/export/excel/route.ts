import ExcelJS from "exceljs"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getReportsData } from "@/lib/reports"

export const runtime = "nodejs"

function periodBounds(period: string) {
  const now = Date.now()
  const ms: Record<string, number> = {
    today: now - new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
    "7d":  7   * 86_400_000,
    "30d": 30  * 86_400_000,
    "90d": 90  * 86_400_000,
    year:  365 * 86_400_000,
  }
  const dur  = ms[period] ?? ms["30d"]
  const from = new Date(now - dur).toISOString()
  const to   = new Date(now).toISOString()
  return { from, to }
}

function headerRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.getRow(1)
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1)
    cell.value  = h
    cell.font   = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }
    cell.alignment = { horizontal: "left" }
  })
  row.commit()
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU")
}

const PROVIDER_LABELS: Record<string, string> = {
  cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum",
}
const STATUS_LABELS: Record<string, string> = {
  paid: "Оплачено", pending: "Ожидает", failed: "Отменён", refunded: "Возврат",
  active: "Активный", expired: "Истёк", frozen: "Заморожен", none: "Нет",
}
const GENDER_LABELS: Record<string, string> = { male: "Мужской", female: "Женский" }
const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", manager: "Менеджер", admin: "Администратор",
  trainer: "Тренер", accountant: "Бухгалтер",
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const club = await getCurrentClub()
  if (!club) return new Response("Club not found", { status: 403 })

  const period = new URL(req.url).searchParams.get("period") ?? "30d"
  const { from, to } = periodBounds(period)

  const data = await getReportsData(supabase, club.clubId)

  const paidPayments = data.payments.filter(
    p => p.status === "paid" && p.paidAt && p.paidAt >= from && p.paidAt <= to
  )
  const periodVisits = data.visits.filter(
    v => v.checkedInAt >= from && v.checkedInAt <= to
  )
  const newClients = data.clients.filter(
    c => c.createdAt >= from && c.createdAt <= to
  )
  const debts = data.payments.filter(p => p.status === "pending")

  const wb = new ExcelJS.Workbook()
  wb.creator = "FitCRM"
  wb.created = new Date()

  // ── Лист 1: Финансы ─────────────────────────────────────────────
  const wsFinance = wb.addWorksheet("Финансы")
  wsFinance.columns = [
    { key: "date",     width: 14 },
    { key: "client",   width: 26 },
    { key: "service",  width: 28 },
    { key: "amount",   width: 18 },
    { key: "provider", width: 16 },
    { key: "paidAt",   width: 14 },
  ]
  headerRow(wsFinance, ["Дата", "Клиент", "Услуга", "Сумма (сум)", "Способ оплаты", "Дата оплаты"])
  for (const p of paidPayments) {
    wsFinance.addRow({
      date:     fmtDate(p.createdAt),
      client:   p.clientName ?? "—",
      service:  p.serviceName ?? "—",
      amount:   p.amount,
      provider: PROVIDER_LABELS[p.provider] ?? p.provider,
      paidAt:   fmtDate(p.paidAt),
    })
  }
  // итоговая строка
  const totalRow = wsFinance.addRow({
    date: "ИТОГО", amount: paidPayments.reduce((a, p) => a + p.amount, 0),
  })
  totalRow.font = { bold: true }
  wsFinance.getColumn("amount").numFmt = "#,##0"

  // ── Лист 2: Клиенты ─────────────────────────────────────────────
  const wsClients = wb.addWorksheet("Клиенты")
  wsClients.columns = [
    { key: "name",       width: 28 },
    { key: "phone",      width: 18 },
    { key: "gender",     width: 12 },
    { key: "status",     width: 14 },
    { key: "membership", width: 24 },
    { key: "expiresAt",  width: 16 },
    { key: "source",     width: 18 },
    { key: "createdAt",  width: 14 },
  ]
  headerRow(wsClients, ["Имя", "Телефон", "Пол", "Статус", "Абонемент", "Истекает", "Источник", "Дата регистр."])
  for (const c of data.clients) {
    wsClients.addRow({
      name:       c.name,
      phone:      c.phone ?? "—",
      gender:     GENDER_LABELS[c.gender ?? ""] ?? "—",
      status:     STATUS_LABELS[c.status] ?? c.status,
      membership: c.membershipName ?? "—",
      expiresAt:  fmtDate(c.expiresAt),
      source:     c.source ?? "—",
      createdAt:  fmtDate(c.createdAt),
    })
  }

  // ── Лист 3: Посещения ────────────────────────────────────────────
  const visitsByDay: Record<string, number> = {}
  for (const v of periodVisits) {
    const d = v.checkedInAt.slice(0, 10)
    visitsByDay[d] = (visitsByDay[d] || 0) + 1
  }
  const wsVisits = wb.addWorksheet("Посещения")
  wsVisits.columns = [
    { key: "date",  width: 14 },
    { key: "count", width: 16 },
  ]
  headerRow(wsVisits, ["Дата", "Количество"])
  for (const [date, count] of Object.entries(visitsByDay).sort()) {
    wsVisits.addRow({ date: fmtDate(date + "T00:00:00"), count })
  }
  const vTotalRow = wsVisits.addRow({ date: "ИТОГО", count: periodVisits.length })
  vTotalRow.font = { bold: true }

  // ── Лист 4: Долги ───────────────────────────────────────────────
  const wsDebts = wb.addWorksheet("Долги")
  wsDebts.columns = [
    { key: "client",    width: 28 },
    { key: "phone",     width: 18 },
    { key: "amount",    width: 18 },
    { key: "createdAt", width: 14 },
  ]
  headerRow(wsDebts, ["Клиент", "Телефон", "Сумма (сум)", "Дата"])
  for (const p of debts) {
    wsDebts.addRow({
      client:    p.clientName ?? "—",
      phone:     p.clientPhone ?? "—",
      amount:    p.amount,
      createdAt: fmtDate(p.createdAt),
    })
  }
  const dTotalRow = wsDebts.addRow({
    client: "ИТОГО", amount: debts.reduce((a, p) => a + p.amount, 0),
  })
  dTotalRow.font = { bold: true }
  wsDebts.getColumn("amount").numFmt = "#,##0"

  // ── Лист 5: Сотрудники ──────────────────────────────────────────
  const wsStaff = wb.addWorksheet("Сотрудники")
  wsStaff.columns = [
    { key: "name",        width: 26 },
    { key: "role",        width: 18 },
    { key: "clientCount", width: 16 },
    { key: "salary",      width: 20 },
    { key: "status",      width: 14 },
  ]
  headerRow(wsStaff, ["Имя", "Роль", "Клиентов", "Зарплата (сум)", "Статус"])
  for (const s of data.staff) {
    wsStaff.addRow({
      name:        s.name,
      role:        ROLE_LABELS[s.role] ?? s.role,
      clientCount: s.clientCount,
      salary:      s.salary,
      status:      STATUS_LABELS[s.status] ?? s.status,
    })
  }
  wsStaff.getColumn("salary").numFmt = "#,##0"

  // ── Сводный лист ────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet("Сводка")
  wsSummary.columns = [
    { key: "metric", width: 38 },
    { key: "value",  width: 22 },
  ]
  headerRow(wsSummary, ["Показатель", "Значение"])
  const totalRevenue = paidPayments.reduce((a, p) => a + p.amount, 0)
  wsSummary.addRows([
    { metric: "Период",                    value: period },
    { metric: "Выручка (сум)",             value: totalRevenue },
    { metric: "Кол-во платежей",           value: paidPayments.length },
    { metric: "Средний чек (сум)",         value: paidPayments.length ? Math.round(totalRevenue / paidPayments.length) : 0 },
    { metric: "Посещений за период",       value: periodVisits.length },
    { metric: "Новых клиентов",            value: newClients.length },
    { metric: "Всего клиентов",            value: data.clients.length },
    { metric: "Активных клиентов",         value: data.clients.filter(c => c.status === "active").length },
    { metric: "Долгов (неоплачено)",       value: debts.length },
    { metric: "Сумма долгов (сум)",        value: debts.reduce((a, p) => a + p.amount, 0) },
    { metric: "Сотрудников",              value: data.staff.length },
  ])
  wsSummary.getColumn("value").numFmt = "#,##0"

  // Move summary to first position
  // reorder: move summary to front
  const idx = wb.worksheets.indexOf(wsSummary)
  if (idx > 0) {
    wb.worksheets.splice(idx, 1)
    wb.worksheets.unshift(wsSummary)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const stamp  = new Date().toISOString().slice(0, 10)

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fitcrm-reports-${period}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
