import { redirect } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { getRolesAction } from "./actions"
import { RolesSettings } from "@/components/app/RolesSettings"

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string; staffName?: string }>
}) {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (club.role !== "owner") redirect("/settings/club")

  const { roles } = await getRolesAction()
  const sp = await searchParams

  return (
    <RolesSettings
      roles={roles}
      isOwner={club.role === "owner"}
      assignStaffId={sp.staffId}
      assignStaffName={sp.staffName}
    />
  )
}
