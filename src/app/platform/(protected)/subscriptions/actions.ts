"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlatformAuth, logPlatformAction } from "@/lib/platform"

/** Подтвердить заявку: активировать тариф клуба на N месяцев. */
export async function approveBillingRequest(id: string): Promise<{ error?: string }> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "forbidden" }
  const service = createServiceClient()

  const { data: req } = await service
    .from("platform_billing_requests")
    .select("club_id, plan, months, status")
    .eq("id", id)
    .maybeSingle()
  if (!req) return { error: "Заявка не найдена" }
  if (req.status !== "pending") return { error: "Заявка уже обработана" }

  const exp = new Date()
  exp.setDate(exp.getDate() + Math.max(1, req.months) * 30)

  await service.from("clubs").update({
    plan: req.plan,
    plan_expires_at: exp.toISOString(),
    status: "active",
    suspended_at: null,
  }).eq("id", req.club_id)

  await service.from("platform_billing_requests").update({
    status: "approved",
    resolved_at: new Date().toISOString(),
    resolved_by: auth.userId,
  }).eq("id", id)

  await logPlatformAction({ action: "approve_billing", clubId: req.club_id, meta: { plan: req.plan, months: req.months } })
  revalidatePath("/platform/subscriptions")
  return {}
}

export async function rejectBillingRequest(id: string): Promise<{ error?: string }> {
  const auth = await getPlatformAuth()
  if (!auth) return { error: "forbidden" }
  const service = createServiceClient()
  const { data: req } = await service.from("platform_billing_requests").select("club_id, status").eq("id", id).maybeSingle()
  if (!req || req.status !== "pending") return { error: "Заявка уже обработана" }
  await service.from("platform_billing_requests").update({
    status: "rejected", resolved_at: new Date().toISOString(), resolved_by: auth.userId,
  }).eq("id", id)
  await logPlatformAction({ action: "reject_billing", clubId: req.club_id })
  revalidatePath("/platform/subscriptions")
  return {}
}
