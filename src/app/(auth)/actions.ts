"use server"

import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { LEGAL_VERSION } from "@/lib/legal"

export type AuthState = { error?: string; message?: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function authErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Этот email уже зарегистрирован"
  }
  if (normalized.includes("invalid") && normalized.includes("email")) return "Введите корректный email"
  if (normalized.includes("rate limit")) return "Слишком много попыток. Попробуйте немного позже"
  if (normalized.includes("password")) return "Пароль не соответствует требованиям безопасности"
  return "Не удалось выполнить операцию. Попробуйте ещё раз"
}

/* ── helper: where to go after login ── */
type AuthClient = Awaited<ReturnType<typeof createClient>>

export async function resolvePostLoginRedirect(userId: string, client?: AuthClient): Promise<string> {
  const supabase = client ?? await createClient()
  const { data } = await supabase
    .from("staff")
    .select("club_id, clubs(settings)")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (!data || data.length === 0) return "/onboarding"
  if (data.length === 1) {
    const joinedClub = Array.isArray(data[0].clubs) ? data[0].clubs[0] : data[0].clubs
    const settings = (joinedClub?.settings as Record<string, unknown> | null) ?? {}
    if (settings.onboarding_started === true && settings.onboarding_completed !== true) return "/onboarding"
    return "/dashboard"
  }
  return "/select-club"
}

/* ── Register owner + create club ── */
export async function signUpWithClub(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const clubName = String(formData.get("clubName") ?? "").trim()
  const acceptedTerms = formData.get("acceptedTerms") === "on"

  if (!email || !password || !clubName) return { error: "Заполните все обязательные поля" }
  if (!EMAIL_PATTERN.test(email)) return { error: "Введите корректный email" }
  if (password.length < 8) return { error: "Пароль должен быть не короче 8 символов" }
  if (password !== confirmPassword) return { error: "Пароли не совпадают" }
  if (!acceptedTerms) return { error: "Примите публичную оферту и согласие на обработку данных" }

  const supabase = await createClient()
  const acceptedAt = new Date().toISOString()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        pending_club_name: clubName,
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        personal_data_consent_at: acceptedAt,
        cross_border_consent_at: acceptedAt,
        legal_version: LEGAL_VERSION,
      },
    },
  })
  if (error) {
    return { error: authErrorMessage(error.message) }
  }

  if (!data.session) {
    return { message: "confirm_email" }
  }

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
  const acceptedLegal = formData?.get("acceptedLegal") === "on"
  if (acceptedLegal) {
    const acceptedAt = new Date().toISOString()
    const cookieStore = await cookies()
    cookieStore.set("fitcrm_pending_legal", `${LEGAL_VERSION}|${acceptedAt}`, {
      path: "/",
      maxAge: 10 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }
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
  if (!EMAIL_PATTERN.test(email)) return { error: "Введите корректный email" }

  const origin = (await headers()).get("origin") ?? ""
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) return { error: authErrorMessage(error.message) }
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
  if (error) return { error: authErrorMessage(error.message) }

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
