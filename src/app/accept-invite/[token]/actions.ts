"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function acceptInviteAction(token: string): Promise<{ error?: string; needsProfile?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Необходимо войти в аккаунт" }

  const service = createServiceClient()

  const { data: invite } = await service
    .from("staff_invitations")
    .select("id, club_id, email, role, invited_by, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle()

  if (!invite) return { error: "Приглашение не найдено" }

  if (invite.accepted_at) {
    return { error: "Это приглашение уже использовано" }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: "Приглашение истекло. Попросите владельца клуба отправить новое." }
  }

  if (invite.email && invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return { error: `Это приглашение отправлено на ${invite.email}` }
  }
  if (invite.role === "owner") {
    const { data: inviter } = await service.from("staff")
      .select("id")
      .eq("club_id", invite.club_id)
      .eq("user_id", invite.invited_by)
      .eq("role", "owner")
      .eq("is_active", true)
      .maybeSingle()
    if (!inviter) return { error: "Приглашение владельца недействительно" }
  }

  // Ensure public.users record exists and has email (handle_new_user trigger may have missed it)
  await service
    .from("users")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id" })

  const { data: acceptedClubId, error: acceptError } = await supabase
    .rpc("accept_staff_invitation", { p_token: token })
  if (acceptError || !acceptedClubId) {
    return { error: "Приглашение уже использовано или недействительно" }
  }

  // Delete all other pending (unaccepted) invites for this user to prevent redirect loops
  if (user.email) {
    await service.from("staff_invitations")
      .delete()
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null)
  }

  const cookieStore = await cookies()
  cookieStore.set("selected_club_id", acceptedClubId, { path: "/", maxAge: 60 * 60 * 24 * 365 })
  cookieStore.delete("pending_invite")

  // Check if user has a name — if not, let the client show the profile setup step
  const { data: profile } = await service.from("users").select("full_name").eq("id", user.id).maybeSingle()
  if (!profile?.full_name?.trim()) {
    return { needsProfile: true }
  }

  redirect("/dashboard")
}

export async function saveProfileAction(firstName: string, lastName: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  if (!fullName) return { error: "Введите имя" }

  const service = createServiceClient()
  const { error } = await service.from("users").update({ full_name: fullName }).eq("id", user.id)
  if (error) return { error: error.message }

  redirect("/dashboard")
}
