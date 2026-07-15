"use client"

import { useActionState } from "react"
import Link from "next/link"
import { sendPasswordReset, type AuthState } from "@/app/(auth)/actions"

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(sendPasswordReset, {})

  if (state.message === "sent") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-16 pb-6">
        <div className="w-full max-w-[384px] text-center space-y-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0fdf4" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Z" stroke="#16a34a" strokeWidth="1.5"/>
              <path d="m22 6-10 7L2 6" stroke="#16a34a" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
            Письмо отправлено
          </h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Проверьте почту — мы отправили ссылку для сброса пароля.
          </p>
          <Link href="/login" className="block text-sm font-medium hover:underline" style={{ color: "#020617" }}>
            Вернуться ко входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-start px-9 pt-9">
        <Link href="/login" className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          style={{ color: "#64748b" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Назад
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-16 pb-6">
        <div className="w-full max-w-[384px]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-1.5" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
              Восстановление пароля
            </h1>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Введите email — отправим ссылку для сброса
            </p>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>Email</label>
              <input name="email" type="email" placeholder="you@example.com" autoFocus required
                className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
                style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
              />
            </div>

            {state.error && <p className="text-sm text-center" style={{ color: "#ef4444" }}>{state.error}</p>}

            <button type="submit" disabled={pending}
              className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ background: "#0f172a" }}>
              {pending ? "Отправляем..." : "Отправить ссылку"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
