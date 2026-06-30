import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getInventory, getInventoryStats, getRecentMovements } from "@/lib/inventory"
import { InventoryClient } from "@/components/app/InventoryClient"
import { redirect } from "next/navigation"

export const metadata = { title: "Склад — FitCRM" }

export default async function WarehousePage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  const [products, stats, movements] = await Promise.all([
    getInventory(supabase, club.clubId),
    getInventoryStats(supabase, club.clubId),
    getRecentMovements(supabase, club.clubId, 50),
  ])
  return <InventoryClient products={products} stats={stats} movements={movements} />
}
