import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { getStaffMember } from "@/lib/staff"
import { StaffProfileClient } from "@/components/app/StaffProfileClient"

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const member = await getStaffMember(supabase, id)
  if (!member) notFound()

  return (
    <div className="p-6">
      <StaffProfileClient member={member} />
    </div>
  )
}
