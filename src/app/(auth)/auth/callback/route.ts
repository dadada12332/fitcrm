import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? ""

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const user = data.session.user

      // Sync Google profile name to users table
      const fullName = user.user_metadata?.full_name as string | undefined
      if (user.id) {
        const service = createServiceClient()
        await service.from("users").upsert(
          {
            id: user.id,
            email: user.email ?? null,
            ...(fullName ? { full_name: fullName } : {}),
          },
          { onConflict: "id", ignoreDuplicates: false },
        )
      }

      // Invite flow has a specific next (e.g. /accept-invite/...)
      if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/dashboard")) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Smart redirect: check if user has a club → dashboard or onboarding
      const { data: staff } = await supabase
        .from("staff")
        .select("club_id, clubs(settings)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      const joinedClub = Array.isArray(staff?.clubs) ? staff.clubs[0] : staff?.clubs
      const settings = (joinedClub?.settings as Record<string, unknown> | null) ?? {}
      const needsOnboarding = !staff
        || (settings.onboarding_started === true && settings.onboarding_completed !== true)

      return NextResponse.redirect(`${origin}${needsOnboarding ? "/onboarding" : "/dashboard"}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
