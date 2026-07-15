import { redirect } from "next/navigation"
import { getProfileAction } from "./actions"
import { ProfileClient } from "./ProfileClient"

export const metadata = { title: "Профиль — FitCRM" }

export default async function ProfilePage() {
  const profile = await getProfileAction()
  if (!profile) redirect("/login")

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Профиль</h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Личные данные и безопасность</p>
      </div>
      <ProfileClient
        fullName={profile.fullName}
        email={profile.email}
        phone={profile.phone}
        avatarPreset={profile.avatarPreset}
        avatarUrl={profile.avatarUrl}
      />
    </div>
  )
}
