import { redirect } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { getRolesAction } from "./actions"
import { RolesSettings } from "@/components/app/RolesSettings"

export default async function RolesPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (club.role !== "owner") redirect("/settings/club")

  const { roles } = await getRolesAction()

  return <RolesSettings roles={roles} isOwner={club.role === "owner"} />
}
