"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { resetPassword, type AuthState } from "@/app/(auth)/actions"

function PwField({ label, name }: { label: string; name: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>{label}</label>
      <div className="relative">
        <input name={name} type={show ? "text" : "password"} placeholder="••••••••" required
          className="h-10 w-full rounded-md px-3 pr-10 text-sm outline-none transition-all"
          style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60 transition-opacity">
          {show ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, {})

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-16 pb-6">
      <div className="w-full max-w-[384px]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-1.5" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
            Новый пароль
          </h1>
          <p className="text-sm" style={{ color: "#64748b" }}>Придумайте надёжный пароль</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <PwField label="Новый пароль" name="password" />
          <PwField label="Подтверждение пароля" name="confirmPassword" />

          {state.error && <p className="text-sm text-center" style={{ color: "#ef4444" }}>{state.error}</p>}

          <button type="submit" disabled={pending}
            className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
            style={{ background: "#0f172a" }}>
            {pending ? "Сохраняем..." : "Сохранить пароль"}
          </button>
        </form>
      </div>
    </div>
  )
}
