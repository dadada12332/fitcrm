"use client"

import { useActionState, useState, useTransition } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { signUpWithClub, signInWithGoogle, type AuthState } from "@/app/(auth)/actions"

function GoogleButton({ disabled, label = "Продолжить через Google" }: { disabled?: boolean; label?: string }) {
  const [pending, start] = useTransition()
  function continueWithGoogle() {
    const formData = new FormData()
    formData.set("acceptedLegal", "on")
    start(() => signInWithGoogle(formData))
  }

  return (
    <button type="button" disabled={pending || disabled}
      onClick={continueWithGoogle}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border/70 bg-background/55 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-background/80 active:scale-[0.98] disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
      </svg>
      {pending ? "Переходим..." : label}
    </button>
  )
}

function Field({
  label, name, type = "text", placeholder, autoFocus, required, rightSlot,
}: {
  label: string; name: string; type?: string; placeholder?: string
  autoFocus?: boolean; required?: boolean; rightSlot?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          name={name} type={type} placeholder={placeholder}
          autoFocus={autoFocus} required={required}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-foreground/15 bg-background/30 px-3 text-sm text-foreground outline-none backdrop-blur-sm transition-[color,box-shadow,background-color] placeholder:text-foreground/50 focus-visible:border-ring focus-visible:bg-background/50 focus-visible:ring-3 focus-visible:ring-ring/30"
          style={{ paddingRight: rightSlot ? "40px" : undefined }}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
    </div>
  )
}

function PasswordField({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          name={name} type={show ? "text" : "password"} placeholder={placeholder ?? "••••••••"} required
          autoComplete="new-password"
          className="h-10 w-full rounded-lg border border-foreground/15 bg-background/30 px-3 pr-10 text-sm text-foreground outline-none backdrop-blur-sm transition-[color,box-shadow,background-color] placeholder:text-foreground/50 focus-visible:border-ring focus-visible:bg-background/50 focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpWithClub, {})
  const [agreed, setAgreed] = useState(false)

  if (state.message === "confirm_email") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 pb-6 sm:px-10 lg:px-12">
        <div className="w-full max-w-[520px]">
          {/* Card */}
          <div className="rounded-2xl p-8 text-center" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(22,163,74,0.14)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Z" stroke="#16a34a" strokeWidth="1.5"/>
                <path d="m22 6-10 7L2 6" stroke="#16a34a" strokeWidth="1.5"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2" style={{ color: "#14532d", letterSpacing: "-0.1px" }}>
              Проверьте почту!
            </h1>
            <p className="text-sm leading-relaxed mb-1" style={{ color: "#166534" }}>
              Мы отправили письмо с ссылкой подтверждения.
            </p>
            <p className="text-sm font-medium mb-6" style={{ color: "#15803d" }}>
              Нажмите на ссылку в письме — и вы попадёте в CRM.
            </p>
            <div className="rounded-xl p-3 mb-5 text-xs" style={{ background: "#fefce8", border: "1px solid #fde047", color: "#713f12" }}>
              Не видите письмо? Проверьте папку <strong>«Спам»</strong>
            </div>
          </div>
          <Link href="/login" className="block text-center text-sm font-medium mt-4 hover:underline" style={{ color: "#64748b" }}>
            Вернуться ко входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end px-9 pt-9">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/45">
          Уже есть аккаунт? <span className="font-semibold">Войти</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-6 sm:px-10 lg:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-7 text-left">
            <h1 className="mb-2 text-3xl font-semibold text-foreground">
              Создайте аккаунт
            </h1>
            <p className="text-base text-foreground/80">Начните бесплатно — без карты</p>
          </div>

          <form action={action} autoComplete="off" className="flex flex-col gap-5" onKeyDown={(e) => { if (e.key === "Enter" && !agreed) e.preventDefault() }}>
            <div className="flex flex-col gap-2">
              <Field label="Email" name="email" type="email" placeholder="you@example.com" autoFocus required />
              <PasswordField label="Пароль" name="password" />
              <PasswordField label="Подтверждение пароля" name="confirmPassword" />
              <Field label="Название клуба" name="clubName" placeholder="PowerGym" required />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" name="acceptedTerms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded"
                style={{ accentColor: "#0f172a", width: 15, height: 15, flexShrink: 0 }} />
              <span className="text-sm leading-snug text-foreground/80">
                Я принимаю{" "}
                <a href="/terms" className="font-medium text-foreground underline hover:opacity-70">
                  публичную оферту
                </a>{" "}
                и даю{" "}
                <a href="/consent" className="font-medium text-foreground underline hover:opacity-70">
                  согласие на обработку и возможную трансграничную передачу данных
                </a>{" "}
                согласно{" "}
                <a href="/privacy" className="font-medium text-foreground underline hover:opacity-70">
                  политике конфиденциальности
                </a>
              </span>
            </label>

            {state.error && (
              <p className="text-sm text-center" style={{ color: "#ef4444" }}>{state.error}</p>
            )}

            <div className="flex flex-col gap-3">
              <button type="submit" disabled={pending || !agreed}
                className="h-10 w-full rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                style={{ background: "#0f172a" }}>
                {pending ? "Создаём аккаунт..." : "Создать аккаунт"}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/80" />
                <span className="text-xs font-medium text-foreground/70">или</span>
                <div className="h-px flex-1 bg-border/80" />
              </div>

              <GoogleButton disabled={!agreed} />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
