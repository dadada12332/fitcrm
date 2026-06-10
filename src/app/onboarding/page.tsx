import { redirect } from "next/navigation"
import Link from "next/link"
import { Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { OnboardingForm } from "./OnboardingForm"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const club = await getCurrentClub(user.id)
  if (club) redirect("/dashboard")

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--orange)" }}>
            <Zap className="w-5 h-5 text-white" fill="white" />
          </span>
          <span className="text-xl text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
            FitCRM
          </span>
        </Link>

        <div className="rounded-3xl p-8 md:p-10" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h1 className="text-3xl mb-2" style={{ color: "var(--on-dark)" }}>Создайте клуб</h1>
          <p className="text-sm mb-8" style={{ color: "var(--on-dark-soft)" }}>
            Один шаг до старта — добавьте свой фитнес-клуб.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
