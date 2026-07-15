"use client"

import { useActionState, useState, useTransition } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { signInWithEmail, signInWithGoogle, type AuthState } from "@/app/(auth)/actions"

function GoogleButton({ next }: { next?: string }) {
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending}
      onClick={() => { const fd = new FormData(); if (next) fd.append("next", next); start(() => signInWithGoogle(fd)) }}
      className="h-10 w-full rounded-md text-sm font-medium flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
      style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
      </svg>
      {pending ? "Переходим..." : "Продолжить через Google"}
    </button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithEmail, {})
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end px-9 pt-9">
        <Link href="/register" className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          style={{ color: "#020617" }}>
          Нет аккаунта? <span className="font-semibold">Зарегистрироваться</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-16 pb-6">
        <div className="w-full max-w-[384px]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-1.5" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
              С возвращением!
            </h1>
            <p className="text-sm" style={{ color: "#64748b" }}>Войдите в свой аккаунт fitCRM</p>
          </div>

          <form action={action} className="flex flex-col gap-5">
            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-2">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>
                  Email
                </label>
                <input name="email" type="email" placeholder="you@example.com" autoFocus required
                  className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
                  style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>
                    Пароль
                  </label>
                  <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: "#64748b" }}>
                    Забыли пароль?
                  </Link>
                </div>
                <div className="relative">
                  <input name="password" type={showPw ? "text" : "password"} placeholder="••••••••" required
                    className="h-10 w-full rounded-md px-3 pr-10 text-sm outline-none transition-all"
                    style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60 transition-opacity">
                    {showPw ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="rememberMe"
                style={{ accentColor: "#0f172a", width: 15, height: 15 }} />
              <span className="text-sm" style={{ color: "#64748b" }}>Запомнить меня</span>
            </label>

            {state.error && (
              <p className="text-sm text-center" style={{ color: "#ef4444" }}>{state.error}</p>
            )}

            <div className="flex flex-col gap-3">
              <button type="submit" disabled={pending}
                className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                style={{ background: "#0f172a" }}>
                {pending ? "Входим..." : "Войти"}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
                <span className="text-xs" style={{ color: "#94a3b8" }}>или</span>
                <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
              </div>

              <GoogleButton next={next} />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
