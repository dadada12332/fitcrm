import type { SupabaseClient } from "@supabase/supabase-js"

export type ScheduleView = "day" | "week" | "month"

export type ClassBookingClient = { bookingId: string; clientId: string; name: string; attended: boolean }

export type ClassItem = {
  id: string
  title: string
  trainerName: string
  roomId: string
  roomName: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  startHour: number
  seatsTotal: number
  seatsBooked: number
  status: "scheduled" | "cancelled"
  price: number
  income: number
  fill: number // 0..1
  bookings: ClassBookingClient[]
}

export type Room = { id: string; name: string }

export type ScheduleKPIs = {
  classes: number
  booked: number
  avgFill: number // %
  cancellations: number
}

export type DaySummary = {
  classes: number
  visits: number
  loadPct: number
  peakTime: string | null
  cancelled: number
}

export type AiRecommendation = { type: "overload" | "underload" | "suggest" | "move"; text: string }

export type ScheduleData = {
  view: ScheduleView
  date: string // anchor date YYYY-MM-DD
  rangeStart: string
  rangeEnd: string
  rooms: Room[]
  trainers: string[]
  classes: ClassItem[]
  kpis: ScheduleKPIs
  daySummary: DaySummary
  recommendations: AiRecommendation[]
}

// ── helpers ──
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fillColor(fill: number, status: ClassItem["status"]): { bg: string; border: string; text: string } {
  if (status === "cancelled") return { bg: "#f1f5f9", border: "#e2e8f0", text: "#94a3b8" }
  if (fill >= 1) return { bg: "#fee2e2", border: "#fecaca", text: "#b91c1c" } // 🔴 мест нет
  if (fill >= 0.7) return { bg: "#fef9c3", border: "#fde68a", text: "#a16207" } // 🟡 почти заполнено
  return { bg: "#dcfce7", border: "#bbf7d0", text: "#15803d" } // 🟢 есть места
}

function mondayOf(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7 // Mon=0
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

function hhmm(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

export async function getScheduleData(
  supabase: SupabaseClient,
  opts: { date?: string; view?: ScheduleView; trainer?: string; room?: string },
): Promise<ScheduleData> {
  const view: ScheduleView = opts.view ?? "day"
  const anchor = opts.date ? new Date(opts.date + "T00:00:00") : new Date()
  anchor.setHours(0, 0, 0, 0)

  let start: Date, end: Date
  if (view === "day") {
    start = new Date(anchor); end = new Date(anchor)
  } else if (view === "week") {
    start = mondayOf(anchor); end = new Date(start); end.setDate(end.getDate() + 6)
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  }

  const [classesRes, roomsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, room_id, date, start_time, end_time, seats_total, seats_booked, status, title, trainer_name, price, rooms(name), class_bookings(id, status, clients(id, full_name))")
      .gte("date", toISODate(start))
      .lte("date", toISODate(end))
      .order("start_time", { ascending: true }),
    supabase.from("rooms").select("id, name").order("name", { ascending: true }),
  ])

  const rooms: Room[] = (roomsRes.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string }))

  let classes: ClassItem[] = (classesRes.data ?? []).map((c) => {
    const room = c.rooms as unknown as { name: string } | null
    const seatsTotal = (c.seats_total as number) ?? 0
    const seatsBooked = (c.seats_booked as number) ?? 0
    const price = Number(c.price ?? 0)
    const bookings: ClassBookingClient[] = ((c.class_bookings as unknown as { id: string; status: string; clients: { id: string; full_name: string } | null }[]) ?? []).map((b) => ({
      bookingId: b.id,
      clientId: b.clients?.id ?? "",
      name: b.clients?.full_name ?? "Клиент",
      attended: b.status === "attended",
    }))
    const startTime = hhmm(c.start_time as string)
    return {
      id: c.id as string,
      title: (c.title as string) ?? "Занятие",
      trainerName: (c.trainer_name as string) ?? "—",
      roomId: c.room_id as string,
      roomName: room?.name ?? "—",
      date: c.date as string,
      startTime,
      endTime: hhmm(c.end_time as string),
      startHour: startTime ? Number(startTime.slice(0, 2)) : 0,
      seatsTotal,
      seatsBooked,
      status: (c.status as ClassItem["status"]) ?? "scheduled",
      price,
      income: seatsBooked * price,
      fill: seatsTotal ? seatsBooked / seatsTotal : 0,
      bookings,
    }
  })

  // фильтры
  if (opts.trainer) classes = classes.filter((c) => c.trainerName === opts.trainer)
  if (opts.room) classes = classes.filter((c) => c.roomId === opts.room)

  const trainers = Array.from(new Set((classesRes.data ?? []).map((c) => c.trainer_name as string).filter(Boolean))).sort()

  // ── KPI / сводка для выбранного дня (anchor) ──
  const dayISO = toISODate(anchor)
  const dayClasses = classes.filter((c) => c.date === dayISO)
  const active = dayClasses.filter((c) => c.status !== "cancelled")
  const cancelled = dayClasses.filter((c) => c.status === "cancelled").length
  const booked = active.reduce((s, c) => s + c.seatsBooked, 0)
  const seatsSum = active.reduce((s, c) => s + c.seatsTotal, 0)
  const avgFill = seatsSum ? Math.round((booked / seatsSum) * 100) : 0

  const kpis: ScheduleKPIs = { classes: active.length, booked, avgFill, cancellations: cancelled }

  // пиковое время — диапазон 3 часа с макс. суммой записей
  let peakTime: string | null = null
  if (active.length) {
    const byHour: Record<number, number> = {}
    for (const c of active) byHour[c.startHour] = (byHour[c.startHour] ?? 0) + c.seatsBooked
    let bestH = -1, bestV = -1
    for (let h = 6; h <= 22; h++) {
      const v = (byHour[h] ?? 0) + (byHour[h + 1] ?? 0) + (byHour[h + 2] ?? 0)
      if (v > bestV) { bestV = v; bestH = h }
    }
    if (bestH >= 0 && bestV > 0) {
      const p = (n: number) => String(n).padStart(2, "0")
      peakTime = `${p(bestH)}:00–${p(bestH + 3)}:00`
    }
  }

  const daySummary: DaySummary = {
    classes: active.length,
    visits: booked,
    loadPct: avgFill,
    peakTime,
    cancelled,
  }

  // ── AI-эвристика по выбранному дню ──
  const recommendations = buildRecommendations(active)

  return {
    view, date: dayISO,
    rangeStart: toISODate(start), rangeEnd: toISODate(end),
    rooms, trainers, classes,
    kpis, daySummary, recommendations,
  }
}

function timeLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`
}

function buildRecommendations(dayClasses: ClassItem[]): AiRecommendation[] {
  const recs: AiRecommendation[] = []
  if (!dayClasses.length) return recs

  const overloaded = dayClasses.filter((c) => c.fill >= 0.9).sort((a, b) => b.fill - a.fill)
  const underloaded = dayClasses.filter((c) => c.fill > 0 && c.fill < 0.3).sort((a, b) => a.fill - b.fill)

  for (const c of overloaded.slice(0, 2)) {
    recs.push({ type: "overload", text: `${c.startTime} «${c.title}» перегружен (${Math.round(c.fill * 100)}%) — добавьте параллельную группу` })
  }
  for (const c of underloaded.slice(0, 2)) {
    recs.push({ type: "underload", text: `${c.startTime} «${c.title}» недозагружен (${Math.round(c.fill * 100)}%) — запустите акцию или перенесите` })
  }

  // свободный популярный слот (вечер) без занятий
  const busyHours = new Set(dayClasses.map((c) => c.startHour))
  const eveningFree = [18, 19, 20].find((h) => !busyHours.has(h))
  if (eveningFree) recs.push({ type: "suggest", text: `Добавьте групповое занятие в ${timeLabel(eveningFree)} — вечерние слоты востребованы` })

  // перенос: из перегруза в свободный час
  if (overloaded.length) {
    const freeHour = [11, 13, 14, 16].find((h) => !busyHours.has(h))
    if (freeHour) recs.push({ type: "move", text: `Перенесите часть «${overloaded[0].title}» на ${timeLabel(freeHour)} для разгрузки пика` })
  }

  return recs
}
