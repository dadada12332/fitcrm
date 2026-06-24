"use client"

import Link from "next/link"
import { useRef, useState, useTransition, useActionState } from "react"
import { signIn, signUp, signInWithGoogle, sendPhoneOTP, verifyPhoneOTP, type AuthState } from "@/app/(auth)/actions"
import { Input } from "@/components/ui/input"

/* ─── Phone mask ─── */
function phoneDigits(v: string) {
  const d = v.replace(/\D/g, "")
  return d.startsWith("998") ? d.slice(3).slice(0, 9) : d.slice(0, 9)
}
function displayPhone(d: string) {
  if (!d) return ""
  if (d.length <= 2) return `+998 (${d}`
  if (d.length <= 5) return `+998 (${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 7) return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5)}`
  return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`
}

/* ─── OTP 6-box input ─── */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  function handleChange(i: number, ch: string) {
    const digit = ch.replace(/\D/g, "").slice(-1)
    const arr = value.padEnd(6, " ").split("")
    arr[i] = digit || " "
    const next = arr.join("").replace(/ /g, "")
    onChange(next.slice(0, 6))
    if (digit && i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 0)
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, 5)
    setTimeout(() => refs.current[focusIdx]?.focus(), 0)
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-xl font-semibold rounded-xl outline-none transition-all"
          style={{
            background: "var(--card-2)",
            border: value[i] ? "2px solid var(--orange)" : "2px solid var(--border)",
            color: "var(--on-dark)",
          }}
        />
      ))}
    </div>
  )
}

/* ─── Main form ─── */
type Method = "email" | "phone"

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login"
  const action = isLogin ? signIn : signUp
  const [emailState, formAction, emailPending] = useActionState<AuthState, FormData>(action, {})

  const [method, setMethod] = useState<Method>("email")
  const [phoneDig, setPhoneDig] = useState("")
  const [otpStep, setOtpStep] = useState<"phone" | "otp">("phone")
  const [otp, setOtp] = useState("")
  const [phoneState, setPhoneState] = useState<AuthState>({})
  const [pending, startTransition] = useTransition()

  function handleSendOTP() {
    if (phoneDig.length !== 9) {
      setPhoneState({ error: "Введите полный номер: +998 (XX) XXX-XX-XX" })
      return
    }
    setPhoneState({})
    startTransition(async () => {
      const res = await sendPhoneOTP(`+998${phoneDig}`)
      if (res.error) setPhoneState({ error: res.error })
      else setOtpStep("otp")
    })
  }

  function handleVerifyOTP() {
    if (otp.length !== 6) {
      setPhoneState({ error: "Введите 6-значный код" })
      return
    }
    setPhoneState({})
    startTransition(async () => {
      const res = await verifyPhoneOTP(`+998${phoneDig}`, otp)
      if (res?.error) setPhoneState({ error: res.error })
    })
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl mb-2" style={{ color: "var(--on-dark)" }}>
        {isLogin ? "Вход" : "Регистрация"}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--on-dark-soft)" }}>
        {isLogin ? "С возвращением в FitCRM" : "Создайте аккаунт FitCRM"}
      </p>

      {/* Google OAuth */}
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full h-11 rounded-xl flex items-center justify-center gap-3 text-sm font-medium transition-colors"
          style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
        >
          <GoogleIcon />
          Войти через Google
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>или</span>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>

      {/* Method tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--card-2)" }}>
        {(["email", "phone"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setPhoneState({}); setOtpStep("phone"); setOtp(""); setPhoneDig("") }}
            className="h-9 rounded-lg text-sm font-medium transition-all"
            style={method === m
              ? { background: "white", color: "var(--on-dark)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { background: "transparent", color: "var(--on-dark-soft)" }}
          >
            {m === "email" ? "Email" : "Телефон"}
          </button>
        ))}
      </div>

      {/* ── Email / password ── */}
      {method === "email" && (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>Email</label>
            <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>Пароль</label>
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </div>

          {emailState.error && <p className="text-sm" style={{ color: "#f87171" }}>{emailState.error}</p>}
          {emailState.message && <p className="text-sm" style={{ color: "#34d399" }}>{emailState.message}</p>}

          <button
            type="submit"
            disabled={emailPending}
            className="w-full h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
            style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
          >
            {emailPending ? "Подождите…" : isLogin ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      )}

      {/* ── Phone OTP ── */}
      {method === "phone" && (
        <div className="flex flex-col gap-4">
          {otpStep === "phone" ? (
            <>
              <div>
                <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>
                  Номер телефона
                </label>
                <Input
                  value={displayPhone(phoneDig)}
                  onChange={(e) => setPhoneDig(phoneDigits(e.target.value))}
                  placeholder="+998 (__) ___-__-__"
                  inputMode="numeric"
                  autoFocus
                />
              </div>

              {phoneState.error && <p className="text-sm" style={{ color: "#f87171" }}>{phoneState.error}</p>}

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={pending}
                className="w-full h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
                style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
              >
                {pending ? "Отправляем…" : "Получить код"}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-1">
                <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
                  Код отправлен на{" "}
                  <span className="font-semibold" style={{ color: "var(--on-dark)" }}>
                    {displayPhone(phoneDig)}
                  </span>
                </p>
              </div>

              <OtpInput value={otp} onChange={setOtp} />

              {phoneState.error && <p className="text-sm text-center" style={{ color: "#f87171" }}>{phoneState.error}</p>}

              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={pending || otp.length !== 6}
                className="w-full h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
                style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
              >
                {pending ? "Проверяем…" : "Войти"}
              </button>

              <button
                type="button"
                onClick={() => { setOtpStep("phone"); setOtp(""); setPhoneState({}) }}
                className="text-sm text-center transition-opacity hover:opacity-70"
                style={{ color: "var(--on-dark-soft)" }}
              >
                Изменить номер
              </button>
            </>
          )}
        </div>
      )}

      <p className="text-sm mt-6 text-center" style={{ color: "var(--on-dark-soft)" }}>
        {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-semibold" style={{ color: "var(--orange)" }}>
          {isLogin ? "Регистрация" : "Вход"}
        </Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
