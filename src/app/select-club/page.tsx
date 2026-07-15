import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { Building2 } from "lucide-react"

export default async function SelectClubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: clubs } = await supabase
    .from("staff")
    .select("club_id, role, clubs(id, name, plan)")
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (!clubs || clubs.length === 0) redirect("/onboarding")
  if (clubs.length === 1) {
    const cookieStore = await cookies()
    cookieStore.set("selected_club_id", clubs[0].club_id, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-1.5" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
            Выберите клуб
          </h1>
          <p className="text-sm" style={{ color: "#64748b" }}>Вы состоите в нескольких клубах</p>
        </div>

        <div className="grid gap-3">
          {clubs.map((s) => {
            const club = s.clubs as unknown as { id: string; name: string; plan: string } | null
            if (!club) return null
            return (
              <form key={s.club_id} action={async () => {
                "use server"
                const { cookies: getCookies } = await import("next/headers")
                const cookieStore = await getCookies()
                cookieStore.set("selected_club_id", s.club_id, { path: "/", maxAge: 60 * 60 * 24 * 365 })
                redirect("/dashboard")
              }}>
                <button type="submit"
                  className="w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md bg-white border border-[#e2e8f0] hover:border-[#0f172a]">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ background: "#0f172a" }}>
                    {club.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: "#020617" }}>{club.name}</p>
                    <p className="text-xs capitalize mt-0.5" style={{ color: "#94a3b8" }}>
                      {s.role} · {club.plan}
                    </p>
                  </div>
                  <Building2 size={16} color="#cbd5e1" />
                </button>
              </form>
            )
          })}
        </div>
      </div>
    </div>
  )
}
