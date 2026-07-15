import { SettingsView } from "../SettingsView"

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string; staffName?: string }>
}) {
  const sp = await searchParams
  return <SettingsView tab="roles" staffId={sp.staffId} staffName={sp.staffName} />
}
