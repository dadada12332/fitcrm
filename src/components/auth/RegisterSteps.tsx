"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { sendPhoneOTP, verifyPhoneOTPWithProfile, signInWithGoogle } from "@/app/(auth)/actions"

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

function Field({ label, value, onChange, placeholder, type = "text", autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
  type?: string; autoFocus?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus}
        className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
        style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
      />
    </div>
  )
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(i: number, ch: string) {
    const digit = ch.replace(/\D/g, "").slice(-1)
    const arr = value.padEnd(6, " ").split("")
    arr[i] = digit || " "
    const next = arr.join("").replace(/ /g, "")
    onChange(next.slice(0, 6))
    if (digit && i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 0)
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(pasted)
    setTimeout(() => refs.current[Math.min(pasted.length, 5)]?.focus(), 0)
  }

  const slot = (i: number) => {
    const isFirst = i % 3 === 0; const isLast = i % 3 === 2
    return (
      <input key={i} ref={(el) => { refs.current[i] = el }}
        type="text" inputMode="numeric" maxLength={1}
        value={value[i] ?? ""}
        onChange={(e) => handleChange(i, e.target.value)}
        onKeyDown={(e) => handleKey(i, e)} onPaste={handlePaste}
        autoFocus={i === 0}
        className="w-11 h-11 text-center text-sm font-medium outline-none transition-all"
        style={{
          background: "white", color: "#020617",
          border: "1.5px solid #e2e8f0",
          borderLeft: isFirst ? "1.5px solid #e2e8f0" : "none",
          borderRadius: isFirst ? "10px 0 0 10px" : isLast ? "0 10px 10px 0" : "0",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a" }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0" }}
      />
    )
  }

  return (
    <div className="flex items-center gap-3 justify-center">
      <div className="flex">{[0, 1, 2].map(slot)}</div>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#cbd5e1" }} />
      <div className="flex">{[3, 4, 5].map(slot)}</div>
    </div>
  )
}

export function RegisterSteps({ next }: { next?: string }) {
  const [tab, setTab] = useState<"gmail" | "phone">("gmail")
  const [step, setStep] = useState<"info" | "otp">("info")

  // shared
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // phone
  const [phoneDig, setPhoneDig] = useState("")

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login"

  function switchTab(t: "gmail" | "phone") {
    setTab(t); setStep("info"); setOtp(""); setError(null)
  }

  /* ── Phone OTP ── */
  function handleSendPhoneOTP() {
    if (!firstName.trim()) { setError("Введите имя"); return }
    if (phoneDig.length !== 9) { setError("Введите полный номер телефона"); return }
    setError(null)
    start(async () => {
      const res = await sendPhoneOTP(`+998${phoneDig}`)
      if (res.error) { setError(res.error); return }
      setStep("otp")
    })
  }

  function handleVerifyPhoneOTP() {
    if (otp.length !== 6) { setError("Введите 6-значный код"); return }
    setError(null)
    start(async () => {
      const res = await verifyPhoneOTPWithProfile(`+998${phoneDig}`, otp, firstName.trim(), lastName.trim(), next)
      if (res?.error) setError(res.error)
    })
  }

  const identifier = displayPhone(phoneDig)

  /* ── OTP step (shared) ── */
  if (step === "otp") {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex justify-end px-9 pt-9">
          <Link href={loginHref} className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
            style={{ color: "#020617" }}>
            Войти
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-16 pb-6">
          <div className="w-full max-w-[384px]">
            <div className="flex flex-col gap-3 items-center text-center mb-6">
              <h1 className="text-2xl font-semibold" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
                Введите код
              </h1>
              <p className="text-sm" style={{ color: "#64748b" }}>
                Код отправлен на <span style={{ color: "#020617", fontWeight: 500 }}>{identifier}</span>
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <OtpBoxes value={otp} onChange={setOtp} />

              {error && <p className="text-sm text-center" style={{ color: "#ef4444" }}>{error}</p>}

              <button type="button"
                onClick={handleVerifyPhoneOTP}
                disabled={pending || otp.length !== 6}
                className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                style={{ background: "#0f172a" }}>
                {pending ? "Проверяем..." : "Продолжить"}
              </button>

              <button type="button"
                onClick={() => { setStep("info"); setOtp(""); setError(null) }}
                className="w-full text-sm text-center hover:opacity-70 transition-opacity"
                style={{ color: "#64748b" }}>
                Изменить номер
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Info step ── */
  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end px-9 pt-9">
        <Link href={loginHref} className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          style={{ color: "#020617" }}>
          Войти
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-16 pb-6">
        <div className="w-full max-w-[384px]">
          {/* Header */}
          <div className="flex flex-col gap-3 items-center text-center pb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
              Создайте аккаунт
            </h1>
            <p className="text-sm" style={{ color: "#64748b" }}>
              {tab === "gmail"
                ? "Введите ваш Gmail для создания аккаунта"
                : "Введите ваш номер для создания аккаунта"}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-md" style={{ background: "#f1f5f9" }}>
              {(["gmail", "phone"] as const).map((t) => (
                <button key={t} type="button" onClick={() => switchTab(t)}
                  className="flex-1 h-7 rounded text-xs font-medium transition-all"
                  style={tab === t
                    ? { background: "white", color: "#020617", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                    : { background: "transparent", color: "#64748b" }}>
                  {t === "gmail" ? "Gmail" : "По номеру"}
                </button>
              ))}
            </div>

            {tab === "gmail" ? (
              /* Google OAuth button */
              <form action={signInWithGoogle}>
                <button type="submit"
                  className="h-10 w-full rounded-md text-sm font-medium flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 active:scale-[0.98]"
                  style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                  </svg>
                  Продолжить с Google
                </button>
              </form>
            ) : (
              /* Phone OTP fields */
              <div className="flex flex-col gap-2">
                <Field
                  label="Номер телефона"
                  value={displayPhone(phoneDig)}
                  onChange={(v) => setPhoneDig(phoneDigits(v))}
                  placeholder="+998 (90) 000-00-00"
                  type="tel"
                  autoFocus
                />
                <Field label="Имя" value={firstName} onChange={setFirstName} placeholder="Андрей" />
                <Field label="Фамилия" value={lastName} onChange={setLastName} placeholder="Иванов" />
              </div>
            )}

            {tab === "phone" && (
              <>
                {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
                <button type="button" onClick={handleSendPhoneOTP} disabled={pending}
                  className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                  style={{ background: "#0f172a" }}>
                  {pending ? "Отправляем..." : "Продолжить"}
                </button>
              </>
            )}

            <p className="text-sm text-center" style={{ color: "#64748b" }}>
              Нажимая «Продолжить», вы принимаете{" "}
              <a href="/terms" className="underline hover:opacity-70" style={{ color: "#64748b", letterSpacing: "-0.084px" }}>
                условия использования
              </a>
              {" "}и{" "}
              <a href="/privacy" className="underline hover:opacity-70" style={{ color: "#64748b", letterSpacing: "-0.084px" }}>
                политику конфиденциальности
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
