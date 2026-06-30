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

  const member = await getStaffMember(supabase, id, club.clubId)
  if (!member) notFound()

  return (
    <div className="p-6">
      <StaffProfileClient member={member} />
    </div>
  )
}
