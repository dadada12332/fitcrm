"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type PlatformLoginState = { error?: string }

const SUPER_ADMIN_EMAILS = ["opadasebe@gmail.com"]

export async function platformSignIn(_prev: PlatformLoginState, formData: FormData): Promise<PlatformLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Введите email и пароль" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { error: "Неверный email или пароль" }

  // Проверяем роль уровня платформы.
  const service = createServiceClient()
  let isAdmin = false
  try {
    const { data: u } = await service.from("users").select("platform_role").eq("id", data.user.id).maybeSingle()
    isAdmin = u?.platform_role === "platform_admin" || u?.platform_role === "super_admin"
  } catch {
    // колонка отсутствует — резервная проверка ниже
  }
  if (!isAdmin && SUPER_ADMIN_EMAILS.includes(email)) isAdmin = true

  if (!isAdmin) {
    await supabase.auth.signOut()
    return { error: "Доступ запрещён. Этот аккаунт не является администратором платформы." }
  }

  // Аудит входа.
  try {
    await service.from("platform_admin_logs").insert({
      admin_id: data.user.id,
      admin_email: email,
      action: "login",
    })
  } catch { /* таблица ещё не создана */ }

  const host = (await headers()).get("host") ?? ""
  redirect(host.startsWith("admin.") ? "/" : "/platform")
}
