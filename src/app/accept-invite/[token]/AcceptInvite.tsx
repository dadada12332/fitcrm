"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { CheckCircle2, AlertCircle, Clock, UserX } from "lucide-react"
import { acceptInviteAction, saveProfileAction } from "./actions"
import { signOut, sendPhoneOTP, verifyPhoneOTPWithProfile } from "@/app/(auth)/actions"

type State = "accept" | "wrong_user" | "expired" | "already_accepted" | "not_found" | "login_required"

interface Props {
  state: State
  token: string
  email: string | null
  roleName: string
  clubName: string
  currentUserEmail: string | null
  currentUserName: string | null
}

/* ── helpers ─────────────────────────────────────────────────────── */

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

function ClubIcon({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm"
      style={{ background: "#0f172a", border: "1.33px solid rgba(255,255,255,0.12)" }}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

function LInput({ name, value, onChange, placeholder, type = "text", autoFocus, defaultValue }: {
  name?: string; value?: string; onChange?: (v: string) => void; placeholder?: string
  type?: string; autoFocus?: boolean; defaultValue?: string
}) {
  return (
    <input
      name={name} type={type}
      value={value} defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus}
      className="w-full h-10 px-3 rounded-md text-sm outline-none transition-all"
      style={{ border: "1px solid #e2e8f0", color: "#020617", background: "white" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.08)" }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }}
    />
  )
}

function LBtn({ children, onClick, disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="w-full h-10 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
      style={{ background: "#0f172a" }}>
      {children}
    </button>
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
        className="w-10 h-10 text-center text-sm font-medium outline-none"
        style={{
          background: "white", color: "#020617", border: "1px solid #e2e8f0",
          borderLeft: isFirst ? "1px solid #e2e8f0" : "none",
          borderRadius: isFirst ? "6px 0 0 6px" : isLast ? "0 6px 6px 0" : "0",
        }} />
    )
  }
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="flex">{[0, 1, 2].map(slot)}</div>
      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#94a3b8" }} />
      <div className="flex">{[3, 4, 5].map(slot)}</div>
    </div>
  )
}

/* ── Stepper ─────────────────────────────────────────────────────── */

function Stepper({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[{ n: 1, label: "Регистрация" }, { n: 2, label: "Принятие инвайта" }].map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2">
          {i > 0 && <div className="w-8 h-px" style={{ background: current > 1 ? "#0f172a" : "#e2e8f0" }} />}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
              style={{
                background: current >= n ? "#0f172a" : "white",
                color: current >= n ? "white" : "#94a3b8",
                border: current >= n ? "none" : "1.5px solid #e2e8f0",
              }}>
              {n}
            </div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: current >= n ? "#020617" : "#94a3b8" }}>
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Shared card shell ───────────────────────────────────────────── */

function PageShell({ children, topRight }: { children: React.ReactNode; topRight?: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end px-9 pt-9">
        {topRight}
      </div>
      <div className="flex-1 flex items-center justify-center px-8 pb-8">
        <div className="w-full max-w-[336px]">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────── */

export function AcceptInvite({ state, token, email, roleName, clubName, currentUserEmail, currentUserName }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [profileStep, setProfileStep] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  // Phone OTP registration state
  const [regStep, setRegStep] = useState<"info" | "otp">("info")
  const [phoneDig, setPhoneDig] = useState("")
  const [otp, setOtp] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phonePending, startPhone] = useTransition()

  const next = `/accept-invite/${token}`

  function handleSaveProfile() {
    if (!firstName.trim()) { setError("Введите имя"); return }
    setError(null)
    startTransition(async () => {
      const res = await saveProfileAction(firstName.trim(), lastName.trim())
      if (res?.error) setError(res.error)
    })
  }

  function handleSendOTP() {
    if (!firstName.trim()) { setPhoneError("Введите имя"); return }
    if (phoneDig.length !== 9) { setPhoneError("Введите полный номер телефона"); return }
    setPhoneError(null)
    startPhone(async () => {
      const res = await sendPhoneOTP(`+998${phoneDig}`)
      if (res.error) setPhoneError(res.error)
      else setRegStep("otp")
    })
  }

  function handleVerifyOTP() {
    if (otp.length !== 6) { setPhoneError("Введите 6-значный код"); return }
    setPhoneError(null)
    startPhone(async () => {
      const res = await verifyPhoneOTPWithProfile(`+998${phoneDig}`, otp, firstName.trim(), lastName.trim(), next)
      if (res?.error) setPhoneError(res.error)
    })
  }

  /* ── Profile step (after accept if no name) ── */
  if (profileStep) {
    return (
      <PageShell>
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <ClubIcon name={clubName} />
            <h1 className="text-2xl font-semibold mt-3" style={{ color: "#020617", letterSpacing: "-0.144px" }}>Добро пожаловать!</h1>
            <p className="text-sm" style={{ color: "#64748b" }}>Представьтесь — коллеги увидят вас в системе</p>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Имя</label>
              <LInput value={firstName} onChange={setFirstName} placeholder="Андрей" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Фамилия</label>
              <LInput value={lastName} onChange={setLastName} placeholder="Иванов" />
            </div>
          </div>
          {error && <p className="text-sm text-center" style={{ color: "#dc2626" }}>{error}</p>}
          <LBtn onClick={handleSaveProfile} disabled={pending || !firstName.trim()}>
            {pending ? "Сохраняем..." : "Войти в CRM"}
          </LBtn>
        </div>
      </PageShell>
    )
  }

  /* ── Not found ── */
  if (state === "not_found") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "#fef2f2" }}>
            <AlertCircle className="w-6 h-6" style={{ color: "#dc2626" }} />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "#020617" }}>Приглашение не найдено</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>Ссылка недействительна или приглашение было удалено.</p>
          <LBtn onClick={() => window.location.href = "/login"}>Войти в fitCRM</LBtn>
        </div>
      </PageShell>
    )
  }

  /* ── Expired ── */
  if (state === "expired") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "#fffbeb" }}>
            <Clock className="w-6 h-6" style={{ color: "#d97706" }} />
          </div>
          <div>
            <ClubIcon name={clubName} />
            <h1 className="text-xl font-semibold mt-3" style={{ color: "#020617" }}>{clubName}</h1>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Срок действия приглашения истёк.{email ? ` Попросите владельца клуба отправить новое на ${email}.` : " Попросите владельца клуба отправить новое приглашение."}
          </p>
          <Link href="/login" className="block w-full h-10 rounded-md text-sm font-medium text-center leading-10 transition-opacity hover:opacity-80"
            style={{ background: "#f1f5f9", color: "#020617" }}>
            Войти в fitCRM
          </Link>
        </div>
      </PageShell>
    )
  }

  /* ── Already accepted ── */
  if (state === "already_accepted") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0fdf4" }}>
            <CheckCircle2 className="w-6 h-6" style={{ color: "#16a34a" }} />
          </div>
          <div>
            <ClubIcon name={clubName} />
            <h1 className="text-xl font-semibold mt-3" style={{ color: "#020617" }}>Вы уже участник {clubName}</h1>
          </div>
          <Link href="/dashboard" className="block w-full h-10 rounded-md text-sm font-medium text-white text-center leading-10 transition-opacity hover:opacity-90"
            style={{ background: "#0f172a" }}>
            Открыть CRM
          </Link>
        </div>
      </PageShell>
    )
  }

  /* ── Wrong user ── */
  if (state === "wrong_user") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "#fef2f2" }}>
            <UserX className="w-6 h-6" style={{ color: "#dc2626" }} />
          </div>
          <div>
            <ClubIcon name={clubName} />
            <h1 className="text-xl font-semibold mt-3" style={{ color: "#020617" }}>{clubName}</h1>
          </div>
          <div className="rounded-lg p-3 text-sm text-left space-y-1" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#64748b" }}>Приглашение отправлено на <span className="font-medium" style={{ color: "#020617" }}>{email}</span></p>
            <p style={{ color: "#64748b" }}>Вы вошли как <span className="font-medium" style={{ color: "#020617" }}>{currentUserEmail}</span></p>
          </div>
          <form action={signOut}>
            <input type="hidden" name="next" value={`/login?next=/accept-invite/${token}`} />
            <button type="submit" className="w-full h-10 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: "#0f172a" }}>
              Выйти и войти с нужного аккаунта
            </button>
          </form>
        </div>
      </PageShell>
    )
  }

  /* ── Login required — multi-step ── */
  if (state === "login_required") {
    return (
      <PageShell topRight={
        <Link href="/login" className="text-xs font-medium px-3 py-1 rounded-md hover:bg-slate-50 transition-colors" style={{ color: "#020617" }}>
          Войти
        </Link>
      }>
        <Stepper current={1} />

        {/* Club info */}
        <div className="text-center mb-6">
          <ClubIcon name={clubName} />
          <h1 className="text-xl font-semibold mt-2" style={{ color: "#020617" }}>{clubName}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            Приглашает вас как <span className="font-medium" style={{ color: "#020617" }}>{roleName}</span>
          </p>
        </div>

        {/* Phone registration */}
        {regStep === "info" && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Имя</label>
              <LInput value={firstName} onChange={setFirstName} placeholder="Андрей" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Фамилия</label>
              <LInput value={lastName} onChange={setLastName} placeholder="Иванов" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Номер телефона</label>
              <LInput
                value={displayPhone(phoneDig)}
                onChange={(v) => setPhoneDig(phoneDigits(v))}
                placeholder="+998 (90) 000-00-00"
                type="tel"
              />
            </div>
            {phoneError && <p className="text-sm" style={{ color: "#dc2626" }}>{phoneError}</p>}
            <div className="pt-1">
              <LBtn onClick={handleSendOTP} disabled={phonePending}>
                {phonePending ? "Отправляем..." : "Продолжить"}
              </LBtn>
            </div>
          </div>
        )}

        {/* OTP step */}
        {regStep === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-center" style={{ color: "#64748b" }}>
              Код отправлен на {displayPhone(phoneDig)}
            </p>
            <OtpBoxes value={otp} onChange={setOtp} />
            {phoneError && <p className="text-sm text-center" style={{ color: "#dc2626" }}>{phoneError}</p>}
            <LBtn onClick={handleVerifyOTP} disabled={phonePending || otp.length !== 6}>
              {phonePending ? "Проверяем..." : "Продолжить"}
            </LBtn>
            <button type="button" onClick={() => { setRegStep("info"); setOtp(""); setPhoneError(null) }}
              className="w-full text-sm text-center hover:opacity-70 transition-opacity" style={{ color: "#64748b" }}>
              Изменить номер
            </button>
          </div>
        )}

      </PageShell>
    )
  }

  /* ── Accept — step 2, Figma design ── */
  return (
    <PageShell>
      <Stepper current={2} />

      <div className="text-center mb-6">
        <ClubIcon name={clubName} />
        <h1 className="text-xl font-semibold mt-2" style={{ color: "#020617" }}>{clubName}</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
          Приглашает вас как <span className="font-medium" style={{ color: "#020617" }}>{roleName}</span>
        </p>
      </div>

      <div className="space-y-3">
        {!currentUserName && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Имя</label>
              <LInput value={firstName} onChange={setFirstName} placeholder="Андрей" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#020617" }}>Фамилия</label>
              <LInput value={lastName} onChange={setLastName} placeholder="Иванов" />
            </div>
          </>
        )}

        {error && <p className="text-sm text-center" style={{ color: "#dc2626" }}>{error}</p>}

        <LBtn
          onClick={() => {
            if (!currentUserName && !firstName.trim()) { setError("Введите имя"); return }
            setError(null)
            startTransition(async () => {
              if (!currentUserName && firstName.trim()) {
                const profRes = await saveProfileAction(firstName.trim(), lastName.trim())
                if (profRes?.error) { setError(profRes.error); return }
              }
              const res = await acceptInviteAction(token)
              if (res?.needsProfile) { setProfileStep(true); return }
              if (res?.error) setError(res.error)
            })
          }}
          disabled={pending}
        >
          {pending ? "Присоединяемся..." : "Принять"}
        </LBtn>

        {currentUserEmail && (
          <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
            Вы входите как <span style={{ color: "#64748b" }}>{currentUserEmail}</span>
          </p>
        )}
      </div>
    </PageShell>
  )
}
