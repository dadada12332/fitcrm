import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getStaffKPI, getStaffList } from "@/lib/staff"
import { StaffClient } from "@/components/app/StaffClient"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // raw debug query — no settings column to avoid schema cache issues
  const { data: rawStaff, error: rawErr } = await supabase
    .from("staff")
    .select("id, user_id, role, salary, is_active")

  const [kpi, list] = await Promise.all([
    getStaffKPI(supabase),
    getStaffList(supabase),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#020617" }}>Сотрудники</h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Управление командой, зарплатами и правами доступа</p>
        {/* debug */}
        <p className="text-xs mt-1 font-mono" style={{ color: "#94a3b8" }}>
          raw: {rawStaff?.length ?? 0} rows {rawErr ? `| err: ${rawErr.message}` : ""}
          {" | "}list: {list.length} rows
        </p>
      </div>
      <StaffClient kpi={kpi} rows={list} />
    </div>
  )
}
