import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { AcceptInvite } from "./AcceptInvite"

const ROLE_NAMES: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  manager: "Менеджер",
  trainer: "Тренер",
  accountant: "Бухгалтер",
  cashier: "Кассир",
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceClient()

  const { data: invite } = await service
    .from("staff_invitations")
    .select("id, email, role, club_id, expires_at, accepted_at, clubs(name)")
    .eq("token", token)
    .maybeSingle()

  if (!invite) {
    return (
      <AcceptInvite
        state="not_found"
        token={token}
        email=""
        roleName=""
        clubName=""
        currentUserEmail={null}
        currentUserName={null}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const clubName = ((invite.clubs as unknown) as { name: string } | null)?.name ?? "Клуб"
  const roleName = ROLE_NAMES[invite.role] ?? invite.role
  const isExpired = new Date(invite.expires_at) < new Date()
  const isAccepted = !!invite.accepted_at

  type State = "accept" | "wrong_user" | "expired" | "already_accepted" | "login_required"
  let state: State = "accept"
  if (isExpired) state = "expired"
  else if (isAccepted) state = "already_accepted"
  else if (!user) state = "login_required"
  else if (invite.email && (user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) state = "wrong_user"

  let currentUserName: string | null = null
  if (user) {
    const { data: profile } = await service.from("users").select("full_name").eq("id", user.id).maybeSingle()
    currentUserName = profile?.full_name?.trim() || null
  }

  return (
    <AcceptInvite
      state={state}
      token={token}
      email={invite.email ?? null}
      roleName={roleName}
      clubName={clubName}
      currentUserEmail={user?.email ?? null}
      currentUserName={currentUserName}
    />
  )
}
