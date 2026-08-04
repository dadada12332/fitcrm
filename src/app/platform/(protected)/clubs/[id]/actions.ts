"use server"

import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { logPlatformAction, requirePlatformPermission } from "@/lib/platform"

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
  await requirePlatformPermission("clubs.manage")

  const service = createServiceClient()
  const { data: club, error } = await service.from("clubs").select("name").eq("id", clubId).maybeSingle()
  if (error || !club) throw new Error("club not found")

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
  const auth = await requirePlatformPermission("clubs.manage")
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: "Срок должен быть от 1 до 365 дней" }
  const service = createServiceClient()
  const { error } = await service.rpc("platform_extend_club_trial", {
    p_club_id: clubId,
    p_days: days,
    p_admin_id: auth.userId,
  })
  if (error?.message.includes("platform_trial_only")) return { error: "Продлить можно только действующий или истёкший Trial" }
  if (error) return { error: "Не удалось продлить Trial" }
  revalidatePath(`/platform/clubs/${clubId}`)
  return {}
}

export async function changePlan(clubId: string, planCode: string) {
  const auth = await requirePlatformPermission("clubs.manage")
  const service = createServiceClient()
  const { error } = await service.rpc("platform_change_club_plan", {
    p_club_id: clubId,
    p_plan_code: planCode,
    p_admin_id: auth.userId,
  })
  if (error?.message.includes("platform_plan_already_assigned")) return { error: "Этот тариф уже назначен клубу" }
  if (error?.message.includes("platform_plan_capacity_exceeded")) return { error: "Текущие данные клуба превышают лимиты выбранного тарифа" }
  if (error?.message.includes("platform_plan_capacity_unconfigured")) return { error: "У выбранного тарифа не настроены все лимиты" }
  if (error?.message.includes("platform_plan_period_unsupported")) return { error: "Назначение поддерживает только помесячные платные тарифы" }
  if (error?.message.includes("platform_trial_identity_invalid")) return { error: "Поддерживается только системный Trial" }
  if (error) return { error: "Не удалось изменить тариф" }
  revalidatePath(`/platform/clubs/${clubId}`)
  return {}
}

export async function setClubStatus(clubId: string, status: "active" | "suspended") {
  await requirePlatformPermission("clubs.manage")
  const service = createServiceClient()
  const { data: updated, error } = await service.from("clubs").update({
    status,
    suspended_at: status === "suspended" ? new Date().toISOString() : null,
  }).eq("id", clubId).select("id").maybeSingle()
  if (error || !updated) return { error: "Не удалось изменить статус клуба" }
  await logPlatformAction({ action: status === "suspended" ? "suspend" : "unsuspend", clubId })
  revalidatePath(`/platform/clubs/${clubId}`)
  return {}
}
