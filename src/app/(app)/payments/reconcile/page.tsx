import { getCurrentClub } from "@/lib/club"
import { getReconciliationRows } from "@/lib/reconcile"
import { createServiceClient } from "@/lib/supabase/service"
import { ReconcileClient } from "@/components/app/ReconcileClient"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ReconcilePage() {
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.payments.view) redirect("/dashboard")

  const [rows, credsRes] = await Promise.all([
    getReconciliationRows(club.clubId),
    createServiceClient().from("club_payment_credentials")
      .select("provider").eq("club_id", club.clubId).eq("enabled", true),
  ])
  const connected = (credsRes.data ?? []).map((c: { provider: string }) => c.provider)

  return <ReconcileClient initialRows={rows} connected={connected} />
}
