import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { getStaffMember } from "@/lib/staff"
import { StaffProfileClient } from "@/components/app/StaffProfileClient"

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.staff.view) redirect("/dashboard")

  const [member, rolesRes] = await Promise.all([
    getStaffMember(supabase, id, club.clubId, {
      includeSalary: club.permissions.staff.salaries,
    }),
    club.permissions.settings.roles ? supabase
      .from("club_roles")
      .select("id, key, name, is_system")
      .eq("club_id", club.clubId)
      .order("created_at") : Promise.resolve({ data: [] }),
  ])
  if (!member) notFound()

  const roles = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: r.is_system,
  }))

  return (
    <div className="space-y-5">
      <StaffProfileClient
        member={member}
        roles={roles}
        canManageRoles={club.permissions.settings.roles}
        canEdit={club.permissions.staff.edit}
        canViewSalary={club.permissions.staff.salaries}
        canManagePermissions={club.permissions.settings.roles}
      />
    </div>
  )
}
