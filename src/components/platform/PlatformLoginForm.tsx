"use client"

import { useActionState } from "react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { platformSignIn, type PlatformLoginState } from "@/app/platform/login/actions"

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState<PlatformLoginState, FormData>(platformSignIn, {})

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #0b1120 55%)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)", boxShadow: "0 8px 32px rgba(99,102,241,0.35)" }}
          >
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-[-0.2px]">FitCRM Platform</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>Панель управления SaaS</p>
        </div>

        <form
          action={action}
          className="rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: "rgba(15,23,42,0.7)", border: "1px solid #1e293b", backdropFilter: "blur(12px)" }}
        >
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Email</label>
            <input
              name="email"
              type="email"
              autoComplete="off"
              placeholder="admin@fitcrm.uz"
              className="w-full h-11 px-3 rounded-lg text-sm outline-none text-white"
              style={{ background: "#0f172a", border: "1px solid #334155" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Пароль</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-11 px-3 rounded-lg text-sm outline-none text-white"
              style={{ background: "#0f172a", border: "1px solid #334155" }}
            />
          </div>

          {state.error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)" }}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {pending ? "Проверка..." : "Войти в Platform"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#475569" }}>
          Доступ только для platform_admin / super_admin.<br />Все действия логируются.
        </p>
      </div>
    </div>
  )
}
