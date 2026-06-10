import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { AppShell } from "@/components/app/AppShell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const club = await getCurrentClub(user.id)
  if (!club) redirect("/onboarding")

  return (
    <AppShell clubName={club.clubName} email={user.email ?? ""}>
      {children}
    </AppShell>
  )
}
