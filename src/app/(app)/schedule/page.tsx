import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getScheduleData, type ScheduleView } from "@/lib/schedule"
import { ScheduleToolbar } from "@/components/app/ScheduleToolbar"
import { ScheduleKPIs } from "@/components/app/ScheduleKPIs"
import { ScheduleCalendar } from "@/components/app/ScheduleCalendar"
import { ScheduleSidebar } from "@/components/app/ScheduleSidebar"
import { AddClassButton } from "@/components/app/AddClassButton"
import { getTrainers } from "@/lib/staff"
import { redirect } from "next/navigation"

type SP = { date?: string; view?: string; trainer?: string; room?: string }

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const view: ScheduleView = sp.view === "week" || sp.view === "month" ? sp.view : "day"

  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.schedule.view) redirect("/dashboard")
  const [data, clientsRes, trainers] = await Promise.all([
    getScheduleData(supabase, { date: sp.date, view, trainer: sp.trainer, room: sp.room }, club.clubId),
    supabase.from("clients").select("id, full_name").eq("club_id", club.clubId).order("full_name", { ascending: true }),
    getTrainers(supabase, club.clubId),
  ])

  const clients = (clientsRes.data ?? []).map((c) => ({ id: c.id as string, name: c.full_name as string }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Расписание</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Управление загрузкой клуба: занятия, залы, тренеры</p>
        </div>
        {club.permissions.schedule.create && <AddClassButton rooms={data.rooms} defaultDate={data.date} trainers={trainers} />}
      </div>

      <ScheduleToolbar
        view={data.view}
        date={data.date}
        trainer={sp.trainer ?? ""}
        room={sp.room ?? ""}
        rooms={data.rooms}
        trainers={data.trainers}
      />

      <ScheduleKPIs kpis={data.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        <ScheduleCalendar data={data} clients={clients} />
        <ScheduleSidebar summary={data.daySummary} recommendations={data.recommendations} />
      </div>
    </div>
  )
}
