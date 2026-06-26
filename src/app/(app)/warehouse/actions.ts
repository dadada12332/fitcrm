"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function addProductAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staffRow) return { error: "Клуб не найден" }

  const name = formData.get("name") as string
  const category = formData.get("category") as string | null
  const unit = (formData.get("unit") as string) || "шт"
  const sellPrice = Number(formData.get("sell_price") ?? 0)
  const buyPrice = Number(formData.get("buy_price") ?? 0)
  const minQty = Number(formData.get("min_quantity") ?? 0)
  const initialQty = Number(formData.get("initial_quantity") ?? 0)
  const sku = formData.get("sku") as string | null

  const { data: product, error: pe } = await supabase
    .from("products")
    .insert({ club_id: staffRow.club_id, name, category: category || null, unit, sell_price: sellPrice, buy_price: buyPrice, sku: sku || null })
    .select("id").single()

  if (pe || !product) return { error: pe?.message ?? "Ошибка создания товара" }

  await supabase.from("inventory").insert({
    club_id: staffRow.club_id, product_id: product.id,
    quantity: initialQty, min_quantity: minQty,
  })

  if (initialQty > 0) {
    await supabase.from("stock_movements").insert({
      club_id: staffRow.club_id, product_id: product.id,
      type: "supply", qty: initialQty, unit_price: buyPrice, note: "Начальный остаток",
    })
  }

  revalidatePath("/warehouse")
  return { ok: true }
}

export async function addSupplyAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staffRow) return { error: "Клуб не найден" }

  const productId = formData.get("product_id") as string
  const qty = Number(formData.get("qty"))
  const unitPrice = Number(formData.get("unit_price") ?? 0)
  const note = formData.get("note") as string | null

  if (!productId || qty <= 0) return { error: "Некорректные данные" }

  await supabase.from("stock_movements").insert({
    club_id: staffRow.club_id, product_id: productId,
    type: "supply", qty, unit_price: unitPrice, note: note || null,
  })

  const { error: rpcError } = await supabase.rpc("increment_inventory", {
    p_product_id: productId, p_qty: qty, p_club_id: staffRow.club_id,
  })
  if (rpcError) {
    const { data: invRow } = await supabase
      .from("inventory").select("quantity").eq("product_id", productId).single()
    if (invRow) {
      await supabase.from("inventory")
        .update({ quantity: Number(invRow.quantity) + qty, updated_at: new Date().toISOString() })
        .eq("product_id", productId)
    } else {
      await supabase.from("inventory").insert({
        club_id: staffRow.club_id, product_id: productId, quantity: qty, min_quantity: 0,
      })
    }
  }

  revalidatePath("/warehouse")
  return { ok: true }
}

export async function writeoffAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staffRow } = await supabase
    .from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staffRow) return { error: "Клуб не найден" }

  const productId = formData.get("product_id") as string
  const qty = Number(formData.get("qty"))
  const note = formData.get("note") as string | null

  if (!productId || qty <= 0) return { error: "Некорректные данные" }

  const { data: inv } = await supabase
    .from("inventory").select("quantity").eq("product_id", productId).single()
  if (!inv) return { error: "Товар не найден" }
  if (Number(inv.quantity) < qty) return { error: "Недостаточно товара на складе" }

  await supabase.from("stock_movements").insert({
    club_id: staffRow.club_id, product_id: productId,
    type: "writeoff", qty, unit_price: 0, note: note || null,
  })
  await supabase.from("inventory")
    .update({ quantity: Number(inv.quantity) - qty, updated_at: new Date().toISOString() })
    .eq("product_id", productId)

  revalidatePath("/warehouse")
  return { ok: true }
}
