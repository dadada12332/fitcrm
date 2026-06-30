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

  const [member, rolesRes] = await Promise.all([
    getStaffMember(supabase, id, club.clubId),
    supabase
      .from("club_roles")
      .select("id, key, name, is_system")
      .eq("club_id", club.clubId)
      .order("created_at"),
  ])
  if (!member) notFound()

  const roles = (rolesRes.data ?? []).map((r: any) => ({
    id: r.id as string,
    key: r.key as string,
    name: r.name as string,
    isSystem: r.is_system as boolean,
  }))

  return (
    <div className="p-6">
      <StaffProfileClient
        member={member}
        roles={roles}
        canManageRoles={["owner", "admin"].includes(club.role)}
      />
    </div>
  )
}
