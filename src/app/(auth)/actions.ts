"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type AuthState = { error?: string; message?: string }

/* ── helper: where to go after login ── */
type AuthClient = Awaited<ReturnType<typeof createClient>>

export async function resolvePostLoginRedirect(userId: string, client?: AuthClient): Promise<string> {
  const supabase = client ?? await createClient()
  const { data } = await supabase
    .from("staff")
    .select("club_id")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (!data || data.length === 0) return "/onboarding"
  if (data.length === 1) return "/dashboard"
  return "/select-club"
}

/* ── Register owner + create club ── */
export async function signUpWithClub(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const clubName = String(formData.get("clubName") ?? "").trim()

  if (!email || !password || !clubName) return { error: "Заполните все обязательные поля" }
  if (password.length < 8) return { error: "Пароль должен быть не короче 8 символов" }
  if (password !== confirmPassword) return { error: "Пароли не совпадают" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    if (error.message.includes("already registered")) return { error: "Этот email уже зарегистрирован" }
    return { error: error.message }
  }

  if (!data.session) {
    return { message: "confirm_email" }
  }

  // Create club + assign owner role via RPC
  const { error: clubError } = await supabase.rpc("create_club", { p_name: clubName })
  if (clubError) return { error: clubError.message }

  redirect("/onboarding")
}

/* ── Sign in with email + password ── */
export async function signInWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "")

  if (!email || !password) return { error: "Введите email и пароль" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: "Неверный email или пароль" }

  // Invite flow
  if (next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && next !== "/dashboard") {
    redirect(next)
  }

  const destination = data.user ? await resolvePostLoginRedirect(data.user.id, supabase) : "/dashboard"
  redirect(destination)
}

/* ── Google OAuth ── */
export async function signInWithGoogle(formData?: FormData) {
  const origin = (await headers()).get("origin") ?? ""
  const supabase = await createClient()

  const next = formData?.get("next") as string | undefined
  const callbackUrl = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl },
  })

  if (error || !data.url) redirect("/login?error=oauth")
  redirect(data.url)
}

/* ── Forgot password ── */
export async function sendPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  if (!email) return { error: "Введите email" }

  const origin = (await headers()).get("origin") ?? ""
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) return { error: error.message }
  return { message: "sent" }
}

/* ── Reset password (from email link) ── */
export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!password) return { error: "Введите новый пароль" }
  if (password.length < 8) return { error: "Пароль должен быть не короче 8 символов" }
  if (password !== confirmPassword) return { error: "Пароли не совпадают" }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect("/dashboard")
}

/* ── Sign out ── */
export async function signOut(formData?: FormData) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const next = formData?.get("next") as string | null
  const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/login"
  redirect(safeNext)
}

/* ── Legacy phone OTP (for accept-invite flow) ── */
export async function sendPhoneOTP(phone: string): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) return { error: error.message }
  return { message: "ok" }
}

export async function verifyPhoneOTP(phone: string, token: string): Promise<AuthState> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" })
  if (error) return { error: "Неверный код или код истёк" }
  const destination = data.user ? await resolvePostLoginRedirect(data.user.id, supabase) : "/dashboard"
  redirect(destination)
}

export async function verifyPhoneOTPWithProfile(
  phone: string,
  token: string,
  firstName: string,
  lastName: string,
  next?: string,
): Promise<AuthState> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" })
  if (error) return { error: "Неверный код или код истёк" }

  if (data.user) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
    if (fullName) {
      const service = createServiceClient()
      await service.from("users").upsert(
        { id: data.user.id, full_name: fullName, email: data.user.email ?? null },
        { onConflict: "id" },
      )
    }
  }

  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && next !== "/dashboard") {
    redirect(next)
  }

  const destination = data.user ? await resolvePostLoginRedirect(data.user.id, supabase) : "/dashboard"
  redirect(destination)
}

/* ── Legacy stubs (AuthForm.tsx still imports these) ── */
export const signIn = signInWithEmail
export const signUp = signUpWithClub
