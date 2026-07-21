import { redirect } from "next/navigation"
import { ClientInbox } from "@/components/app/ClientInbox"
import { getCurrentClub } from "@/lib/club"
import { getInboxBootstrapAction } from "./actions"

export default async function InboxPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.inbox.view) redirect("/dashboard")

  const initial = await getInboxBootstrapAction()
  return (
    <ClientInbox
      clubId={club.clubId}
      initialConversations={initial.conversations}
      initialStaff={initial.staff}
      initialTemplates={initial.templates}
      currentStaffId={initial.currentStaffId}
      initialError={initial.error}
      canReply={club.permissions.inbox.reply}
      canAssign={club.permissions.inbox.assign}
      canManageTemplates={club.permissions.inbox.manage_templates}
    />
  )
}
