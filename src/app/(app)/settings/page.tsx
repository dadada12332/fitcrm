import { SettingsView } from "./SettingsView"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; staffId?: string; staffName?: string }>
}) {
  const sp = await searchParams
  return <SettingsView tab={sp.tab} staffId={sp.staffId} staffName={sp.staffName} />
}
