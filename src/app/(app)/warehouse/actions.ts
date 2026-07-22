"use server"

import { can } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { getCurrentClub } from "@/lib/club"
import { requireRecordLimit } from "@/lib/plan-enforcement"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function addProductAction(formData: FormData) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "warehouse", "supply")) return { error: "Недостаточно прав" }
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true })
    .eq("club_id", club.clubId).eq("is_active", true)
  const limitError = requireRecordLimit(club, "products", count ?? 0)
  if (limitError) return { error: limitError }

  const name = String(formData.get("name") ?? "").trim()
  const category = formData.get("category") as string | null
  const unit = (formData.get("unit") as string) || "шт"
  const sellPrice = Number(formData.get("sell_price") ?? 0)
  const buyPrice = Number(formData.get("buy_price") ?? 0)
  const minQty = Number(formData.get("min_quantity") ?? 0)
  const initialQty = Number(formData.get("initial_quantity") ?? 0)
  const sku = formData.get("sku") as string | null
  const barcode = formData.get("barcode") as string | null
  const description = formData.get("description") as string | null
  const photoUrl = formData.get("photo_url") as string | null

  if (!name || name.length > 160) return { error: "Введите корректное название товара" }
  if (![sellPrice, buyPrice, minQty, initialQty].every(Number.isFinite) || [sellPrice, buyPrice, minQty, initialQty].some((value) => value < 0)) {
    return { error: "Цена и остаток не могут быть отрицательными" }
  }

  const { data: product, error: pe } = await supabase
    .from("products")
    .insert({
      club_id: club.clubId, name, category: category || null, unit,
      sell_price: sellPrice, buy_price: buyPrice, sku: sku || null,
      barcode: barcode || null, description: description || null, photo_url: photoUrl || null,
    })
    .select("id").single()

  if (pe || !product) return { error: pe?.message ?? "Ошибка создания товара" }

  const { error: inventoryError } = await supabase.from("inventory").insert({
    club_id: club.clubId, product_id: product.id,
    quantity: initialQty, min_quantity: minQty,
  })
  if (inventoryError) {
    await supabase.from("products").delete().eq("id", product.id).eq("club_id", club.clubId)
    return { error: "Не удалось создать остаток товара" }
  }

  if (initialQty > 0) {
    const { error: movementError } = await supabase.from("stock_movements").insert({
      club_id: club.clubId, product_id: product.id,
      type: "in", qty: initialQty, unit_price: buyPrice, note: "Начальный остаток",
    })
    if (movementError) {
      await supabase.from("products").delete().eq("id", product.id).eq("club_id", club.clubId)
      return { error: "Не удалось записать начальный остаток" }
    }
  }

  revalidatePath("/warehouse")
  return { ok: true }
}

export async function addSupplyAction(formData: FormData) {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "warehouse", "supply")) return { error: "Недостаточно прав" }

  const productId = formData.get("product_id") as string
  const qty = Number(formData.get("qty"))
  const unitPrice = Number(formData.get("unit_price") ?? 0)
  const note = formData.get("note") as string | null

  if (!UUID.test(productId) || qty <= 0 || !Number.isFinite(qty)) return { error: "Некорректные данные" }
  if (unitPrice < 0) return { error: "Цена не может быть отрицательной" }

  const { data: ok, error } = await createServiceClient().rpc("record_stock_supply", {
    p_club_id: club.clubId,
    p_product_id: productId,
    p_qty: qty,
    p_unit_price: unitPrice,
    p_note: note || null,
  })
  if (error) return { error: "Не удалось сохранить поставку" }
  if (ok !== true) return { error: "Товар не найден или данные поставки некорректны" }

  revalidatePath("/warehouse")
  return { ok: true }
}

export async function writeoffAction(formData: FormData) {
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "warehouse", "writeoff")) return { error: "Недостаточно прав" }

  const productId = formData.get("product_id") as string
  const qty = Number(formData.get("qty"))
  const note = formData.get("note") as string | null

  if (!UUID.test(productId) || qty <= 0 || !Number.isFinite(qty)) return { error: "Некорректные данные" }

  const { data: ok, error } = await createServiceClient().rpc("record_stock_writeoff", {
    p_club_id: club.clubId,
    p_product_id: productId,
    p_qty: qty,
    p_note: note || null,
  })
  if (error) return { error: "Не удалось сохранить списание" }
  if (ok !== true) return { error: "Товар не найден или на складе недостаточно остатка" }

  revalidatePath("/warehouse")
  return { ok: true }
}

export async function deleteProductAction(productId: string) {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) return { error: "Не авторизован" }
  if (!can(club.permissions, "warehouse", "supply")) return { error: "Недостаточно прав" }
  if (!UUID.test(productId)) return { error: "Некорректный товар" }

  const { data: product, error: findError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("club_id", club.clubId)
    .eq("is_active", true)
    .maybeSingle()
  if (findError) return { error: "Не удалось проверить товар" }
  if (!product) return { error: "Товар не найден или уже удалён" }

  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", productId)
    .eq("club_id", club.clubId)
  if (error) return { error: "Не удалось удалить товар" }

  revalidatePath("/warehouse")
  return { ok: true }
}
