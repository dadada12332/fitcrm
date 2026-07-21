import { getCurrentClub } from "@/lib/club"
import { ReportsShell } from "./ReportsShell"
import { redirect } from "next/navigation"

export default async function ReportsPage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.reports.view) redirect("/dashboard")

  // Auth check only — heavy data is loaded client-side in ReportsShell
  // This makes the initial page render instant (~50ms) vs 2-3s with SSR data fetch
  return <ReportsShell canExport={club.permissions.reports.export && club.permissions.reports.finance} />
}
