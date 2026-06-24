"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string; message?: string }

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Введите email и пароль" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Неверный email или пароль" }
  }

  redirect("/dashboard")
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Введите email и пароль" }
  }
  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов" }
  }

  const origin = (await headers()).get("origin") ?? ""
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) {
    return { error: error.message }
  }

  return { message: "Готово! Проверьте почту и подтвердите регистрацию." }
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin") ?? ""
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error || !data.url) {
    redirect("/login?error=oauth")
  }

  redirect(data.url)
}

export async function sendPhoneOTP(phone: string): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) return { error: error.message }
  return { message: "ok" }
}

export async function verifyPhoneOTP(phone: string, token: string): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" })
  if (error) return { error: "Неверный код или код истёк" }
  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
