import { createClient } from "@/lib/supabase/server"
import { getInventory, getInventoryStats, getRecentMovements } from "@/lib/inventory"
import { InventoryClient } from "@/components/app/InventoryClient"

export const metadata = { title: "Склад — FitCRM" }

export default async function WarehousePage() {
  const supabase = await createClient()
  const [products, stats, movements] = await Promise.all([
    getInventory(supabase),
    getInventoryStats(supabase),
    getRecentMovements(supabase, 50),
  ])
  return <InventoryClient products={products} stats={stats} movements={movements} />
}
