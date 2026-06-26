import type { SupabaseClient } from "@supabase/supabase-js"

export type Product = {
  id: string
  name: string
  category: string | null
  unit: string
  sellPrice: number
  buyPrice: number
  sku: string | null
  isActive: boolean
  quantity: number
  minQuantity: number
  updatedAt: string
}

export type StockMovement = {
  id: string
  productId: string
  productName: string
  type: "supply" | "sale" | "writeoff" | "adjustment"
  qty: number
  unitPrice: number
  createdAt: string
  note: string | null
}

export type InventoryStats = {
  totalProducts: number
  lowStockCount: number
  totalValue: number
  totalSalesMonth: number
}

export async function getInventory(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, category, unit, sell_price, buy_price, sku, is_active, inventory(quantity, min_quantity, updated_at)")
    .eq("is_active", true)
    .order("name")

  return (data ?? []).map((p: any) => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory
    return {
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: p.unit ?? "шт",
      sellPrice: Number(p.sell_price),
      buyPrice: Number(p.buy_price),
      sku: p.sku ?? null,
      isActive: p.is_active,
      quantity: Number(inv?.quantity ?? 0),
      minQuantity: Number(inv?.min_quantity ?? 0),
      updatedAt: inv?.updated_at ?? new Date().toISOString(),
    }
  })
}

export async function getInventoryStats(supabase: SupabaseClient): Promise<InventoryStats> {
  const products = await getInventory(supabase)
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1)

  const { data: sales } = await supabase
    .from("stock_movements")
    .select("qty, unit_price")
    .eq("type", "sale")
    .gte("created_at", monthAgo.toISOString())

  return {
    totalProducts: products.length,
    lowStockCount: products.filter(p => p.quantity <= p.minQuantity && p.minQuantity > 0).length,
    totalValue: products.reduce((s, p) => s + p.quantity * p.buyPrice, 0),
    totalSalesMonth: (sales ?? []).reduce((s: number, m: any) => s + Number(m.qty) * Number(m.unit_price), 0),
  }
}

export async function getRecentMovements(supabase: SupabaseClient, limit = 30): Promise<StockMovement[]> {
  const { data } = await supabase
    .from("stock_movements")
    .select("id, product_id, type, qty, unit_price, created_at, note, products(name)")
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((m: any) => ({
    id: m.id,
    productId: m.product_id,
    productName: m.products?.name ?? "—",
    type: m.type,
    qty: Number(m.qty),
    unitPrice: Number(m.unit_price),
    createdAt: m.created_at,
    note: m.note ?? null,
  }))
}
