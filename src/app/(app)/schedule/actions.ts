"use server"

import { can } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"

export type ClassFormState = { error?: string; ok?: boolean }
export type ActionResult = { error?: string; ok?: boolean }

export async function createRoomAction(name: string, capacity?: number): Promise<ActionResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "create")) return { error: "Недостаточно прав" }
  const nm = (name ?? "").trim()
  if (!nm) return { error: "Введите название зала" }
  if (nm.length > 60) return { error: "Слишком длинное название" }

  const supabase = await createClient()
  const cap = Number.isFinite(capacity) && (capacity as number) > 0 ? Math.floor(capacity as number) : null
  const { error } = await supabase.from("rooms").insert({ club_id: club.clubId, name: nm, capacity: cap })
  if (error) return { error: error.message }
  revalidatePath("/schedule")
  return { ok: true }
}

export async function deleteRoomAction(roomId: string): Promise<ActionResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "delete")) return { error: "Недостаточно прав" }

  const supabase = await createClient()
  // Сначала удаляем занятия этого зала и их записи (FK), потом сам зал.
  const { data: cls } = await supabase.from("classes").select("id").eq("club_id", club.clubId).eq("room_id", roomId)
  const ids = (cls ?? []).map((c) => c.id as string)
  if (ids.length) {
    await supabase.from("class_bookings").delete().eq("club_id", club.clubId).in("class_id", ids)
    await supabase.from("classes").delete().eq("club_id", club.clubId).eq("room_id", roomId)
  }
  const { error } = await supabase.from("rooms").delete().eq("id", roomId).eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/schedule")
  return { ok: true }
}

export async function createClassAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  // Все поля необязательные — подставляем разумные значения по умолчанию.
  const title = String(formData.get("title") ?? "").trim() || "Занятие"
  const trainer = String(formData.get("trainer_name") ?? "").trim()
  const roomId = String(formData.get("room_id") ?? "").trim()
  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10)
  const start = String(formData.get("start_time") ?? "").trim() || "08:00"
  const end = String(formData.get("end_time") ?? "").trim() || "09:00"
  let seats = Number(formData.get("seats_total") ?? 0)
  if (!Number.isFinite(seats) || seats <= 0) seats = 10
  let price = Number(formData.get("price") ?? 0)
  if (!Number.isFinite(price) || price < 0) price = 0

  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "create")) return { error: "Недостаточно прав" }

  const supabase = await createClient()
  const { error } = await supabase.from("classes").insert({
    club_id: club.clubId,
    room_id: roomId || null,
    date,
    start_time: start,
    end_time: end,
    seats_total: seats,
    seats_booked: 0,
    status: "scheduled",
    title,
    trainer_name: trainer || null,
    price,
  })
  if (error) return { error: error.message }

  revalidatePath("/schedule")
  return { ok: true }
}

export async function cancelClassAction(id: string): Promise<ActionResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "edit")) return { error: "Недостаточно прав" }
  const supabase = await createClient()
  const { error } = await supabase
    .from("classes")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/schedule")
  return { ok: true }
}

export async function rescheduleClassAction(id: string, date: string, start: string, end: string): Promise<ActionResult> {
  if (!date || !start || !end) return { error: "Укажите дату и время" }
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "edit")) return { error: "Недостаточно прав" }
  const supabase = await createClient()
  const { error } = await supabase
    .from("classes")
    .update({ date, start_time: start, end_time: end, status: "scheduled" })
    .eq("id", id)
    .eq("club_id", club.clubId)
  if (error) return { error: error.message }
  revalidatePath("/schedule")
  return { ok: true }
}

export async function addClientToClassAction(classId: string, clientId: string): Promise<ActionResult> {
  if (!clientId) return { error: "Выберите клиента" }
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "edit")) return { error: "Недостаточно прав" }
  const supabase = await createClient()

  const { data: cls, error: e1 } = await supabase
    .from("classes")
    .select("seats_total, seats_booked")
    .eq("id", classId)
    .eq("club_id", club.clubId)
    .maybeSingle()
  if (e1) return { error: e1.message }
  if (!cls) return { error: "Занятие не найдено" }
  if ((cls.seats_booked ?? 0) >= (cls.seats_total ?? 0)) return { error: "Нет свободных мест" }

  const { error: e2 } = await supabase.from("class_bookings").insert({
    club_id: club.clubId,
    class_id: classId,
    client_id: clientId,
    status: "booked",
  })
  if (e2) return { error: e2.message }

  const { error: e3 } = await supabase
    .from("classes")
    .update({ seats_booked: (cls.seats_booked ?? 0) + 1 })
    .eq("id", classId)
    .eq("club_id", club.clubId)
  if (e3) return { error: e3.message }

  revalidatePath("/schedule")
  return { ok: true }
}

export async function markAttendanceAction(bookingId: string): Promise<ActionResult> {
  const club = await getCurrentClub()
  if (!club) return { error: "Клуб не найден" }
  if (!can(club.permissions, "schedule", "edit")) return { error: "Недостаточно прав" }
  const supabase = await createClient()

  const { data: booking, error: e1 } = await supabase
    .from("class_bookings")
    .select("client_id, status")
    .eq("id", bookingId)
    .eq("club_id", club.clubId)
    .maybeSingle()
  if (e1) return { error: e1.message }
  if (!booking) return { error: "Запись не найдена" }
  if (booking.status === "attended") return { ok: true }

  const { error: e2 } = await supabase
    .from("class_bookings")
    .update({ status: "attended" })
    .eq("id", bookingId)
    .eq("club_id", club.clubId)
  if (e2) return { error: e2.message }

  const { error: e3 } = await supabase.from("visits").insert({
    club_id: club.clubId,
    client_id: booking.client_id,
    method: "manual",
  })
  if (e3) return { error: e3.message }

  revalidatePath("/schedule")
  return { ok: true }
}
