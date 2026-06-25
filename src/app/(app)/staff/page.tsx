import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getStaffKPI, getStaffList } from "@/lib/staff"
import { StaffClient } from "@/components/app/StaffClient"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [kpi, list] = await Promise.all([
    getStaffKPI(supabase),
    getStaffList(supabase),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#020617" }}>Сотрудники</h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Управление командой, зарплатами и правами доступа</p>
      </div>
      <StaffClient kpi={kpi} rows={list} />
    </div>
  )
}
