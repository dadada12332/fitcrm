"use server"

import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlatformAuth, logPlatformAction } from "@/lib/platform"
import { getPlanByCode } from "@/lib/plans"

function cookieDomain(host: string): string | undefined {
  const h = host.split(":")[0]
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return undefined
  // *.vercel.app — публичный суффикс: браузер отклоняет куку с доменом .vercel.app.
  // Ставим host-only куку (platform и CRM на одном хосте — этого достаточно).
  if (h.endsWith(".vercel.app")) return undefined
  const parts = h.split(".")
  if (parts.length >= 2) return "." + parts.slice(-2).join(".")
  return undefined
}

/** Войти в CRM клуба под режимом администратора платформы. */
export async function impersonateClub(clubId: string) {
  const auth = await getPlatformAuth()
  if (!auth) throw new Error("forbidden")

  const service = createServiceClient()
  const { data: club } = await service.from("clubs").select("name").eq("id", clubId).maybeSingle()

  const host = (await headers()).get("host") ?? ""
  const isLocal = host.startsWith("localhost") || /^127\./.test(host)
  const domain = cookieDomain(host)
  const store = await cookies()
  const opts = { httpOnly: true, secure: !isLocal, sameSite: "lax" as const, path: "/", domain, maxAge: 60 * 60 * 4 }
  store.set("pa_impersonate", clubId, opts)
  store.set("selected_club_id", clubId, { ...opts, httpOnly: false })

  await logPlatformAction({ action: "impersonate", clubId, meta: { club: club?.name } })

  // На отдельном admin-домене редиректим на app-домен абсолютным URL; на одном
  // хосте (vercel/локально) — относительный путь, иначе редирект считается внешним
  // и клиентский переход после server action не срабатывает.
  if (host.startsWith("admin.")) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fitcrm.uz"
    redirect(`${appUrl}/dashboard`)
  }
  redirect("/dashboard")
}

export async function extendTrial(clubId: string, days: number) {
  const auth = await getPlatformAuth()
  if (!auth) throw new Error("forbidden")
  const service = createServiceClient()
  const { data: club } = await service.from("clubs").select("trial_expires_at").eq("id", clubId).maybeSingle()
  const base = club?.trial_expires_at && new Date(club.trial_expires_at) > new Date()
    ? new Date(club.trial_expires_at)
    : new Date()
  base.setDate(base.getDate() + days)
  await service.from("clubs").update({ trial_expires_at: base.toISOString(), plan: "trial" }).eq("id", clubId)
  await logPlatformAction({ action: "extend_trial", clubId, meta: { days } })
  revalidatePath(`/platform/clubs/${clubId}`)
}

const ENUM_PLAN_CODES = ["trial", "starter", "standard", "business"]

export async function changePlan(clubId: string, planCode: string) {
  const auth = await getPlatformAuth()
  if (!auth) throw new Error("forbidden")
  const planRow = await getPlanByCode(planCode)
  if (!planRow) throw new Error("unknown plan")
  const service = createServiceClient()

  const update: Record<string, unknown> = {
    plan_id: planRow.id,
    // Снапшот цены на момент подключения (grandfather pricing): клуб сохраняет эту
    // цену, даже если тариф позже подорожает. Меняется только через фазу 6 «применить ко всем».
    plan_price_locked: planRow.is_trial ? null : planRow.price,
    plan_currency_locked: planRow.currency,
    plan_period_locked: planRow.period,
    plan_assigned_at: new Date().toISOString(),
  }
  // enum-колонку clubs.plan обновляем только для базовых кодов (кастомные тарифы живут через plan_id).
  if (ENUM_PLAN_CODES.includes(planCode)) update.plan = planCode
  if (!planRow.is_trial) {
    const exp = new Date(); exp.setDate(exp.getDate() + 30)
    update.plan_expires_at = exp.toISOString()
  }
  await service.from("clubs").update(update).eq("id", clubId)
  await logPlatformAction({ action: "change_plan", clubId, meta: { plan: planCode, price: planRow.price } })
  revalidatePath(`/platform/clubs/${clubId}`)
}

export async function setClubStatus(clubId: string, status: "active" | "suspended") {
  const auth = await getPlatformAuth()
  if (!auth) throw new Error("forbidden")
  const service = createServiceClient()
  await service.from("clubs").update({
    status,
    suspended_at: status === "suspended" ? new Date().toISOString() : null,
  }).eq("id", clubId)
  await logPlatformAction({ action: status === "suspended" ? "suspend" : "unsuspend", clubId })
  revalidatePath(`/platform/clubs/${clubId}`)
}
