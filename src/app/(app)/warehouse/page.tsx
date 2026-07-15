import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getPosProducts, getInventoryStats, getRecentMovements } from "@/lib/inventory"
import { createServiceClient } from "@/lib/supabase/service"
import { WarehouseSwitcher } from "@/components/app/WarehouseSwitcher"
import { redirect } from "next/navigation"

export const metadata = { title: "Склад — FitCRM" }

export default async function WarehousePage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.warehouse.view) redirect("/dashboard")

  const [products, stats, movements, credsRes] = await Promise.all([
    getPosProducts(supabase, club.clubId),
    getInventoryStats(supabase, club.clubId),
    getRecentMovements(supabase, club.clubId, 50),
    createServiceClient().from("club_payment_credentials").select("provider").eq("club_id", club.clubId).eq("enabled", true),
  ])
  const connectedProviders = (credsRes.data ?? []).map((c: { provider: string }) => c.provider)

  return (
    <WarehouseSwitcher
      products={products}
      stats={stats}
      movements={movements}
      connectedProviders={connectedProviders}
      canSell={club.permissions.warehouse.sell}
    />
  )
}
