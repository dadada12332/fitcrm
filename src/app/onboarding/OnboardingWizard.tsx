"use client"

import { useState, useActionState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Clock, CreditCard, Users, ArrowLeft, ArrowRight, Check } from "lucide-react"
import { BrandingCarousel } from "@/app/(auth)/BrandingCarousel"
import { saveClubInfoAction, saveWorkingHoursAction, createFirstMembershipAction, type OnboardingState } from "./actions"
import { MoneyInput } from "@/components/app/MoneyInput"

// ── Steps ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Информация о клубе", short: "О клубе",     sub: "Расскажите о вашем клубе",        Icon: Building2  },
  { id: 2, label: "Рабочие часы",       short: "Часы работы", sub: "Укажите часы работы клуба",        Icon: Clock      },
  { id: 3, label: "Первый абонемент",   short: "Абонемент",   sub: "Создайте первый тип абонемента",   Icon: CreditCard },
  { id: 4, label: "Пригласить команду", short: "Команда",     sub: "Пригласите сотрудников в систему", Icon: Users      },
]

const DAYS = [
  { key: "mon", label: "Понедельник" }, { key: "tue", label: "Вторник" },
  { key: "wed", label: "Среда" },       { key: "thu", label: "Четверг" },
  { key: "fri", label: "Пятница" },     { key: "sat", label: "Суббота" },
  { key: "sun", label: "Воскресенье" },
]

// ── Input style matching auth form ────────────────────────────────

const inputStyle = { border: "1px solid #e2e8f0", color: "#020617", background: "white" } as const

function focusIn(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#0f172a"
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)"
}
function focusOut(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#e2e8f0"
  e.currentTarget.style.boxShadow = "none"
}

function Field({ label, name, placeholder, type = "text", defaultValue, autoFocus, money }: {
  label: string; name: string; placeholder?: string
  type?: string; defaultValue?: string; autoFocus?: boolean; money?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>{label}</label>
      {money ? (
        <MoneyInput name={name} defaultValue={defaultValue} placeholder={placeholder}
          className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
          style={inputStyle} suffixColor="#94a3b8" />
      ) : (
        <input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue}
          autoFocus={autoFocus}
          className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
          style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
      )}
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => {
        const done   = step > s.id
        const active = step === s.id
        const Icon   = s.Icon
        return (
          <div key={s.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? "1" : "none" }}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: done || active ? "#0f172a" : "white",
                  border: (!done && !active) ? "1.5px solid #e2e8f0" : "none",
                }}>
                {done
                  ? <Check className="w-3 h-3 text-white" />
                  : <Icon className="w-3 h-3" style={{ color: active ? "white" : "#94a3b8" }} />
                }
              </div>
              <span className="text-xs font-medium whitespace-nowrap"
                style={{ color: done || active ? "#020617" : "#94a3b8" }}>
                {s.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-3" style={{ height: 1, background: "#e2e8f0" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Nav buttons ───────────────────────────────────────────────────

function NavButtons({ onBack, pending, nextLabel = "Далее", noBack }: {
  onBack?: () => void; pending?: boolean; nextLabel?: string; noBack?: boolean
}) {
  return (
    <div className="flex items-center justify-between pt-5 mt-3">
      {!noBack ? (
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 h-10 px-4 rounded-md text-sm font-medium transition-all hover:bg-slate-50 active:scale-[0.98]"
          style={{ color: "#020617", border: "1px solid #e2e8f0" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
      ) : <div />}
      <button type="submit" disabled={pending}
        className="flex items-center gap-1.5 h-10 px-5 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
        style={{ background: "#0f172a" }}>
        {pending ? "Сохранение…" : nextLabel} {!pending && <ArrowRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    async (prev, fd) => { const r = await saveClubInfoAction(prev, fd); if (r.ok) onNext(); return r }, {}
  )
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Название клуба" name="name" placeholder="PowerGym" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Город" name="city" placeholder="Ташкент" />
        <Field label="Телефон" name="phone" type="tel" placeholder="+998 90 000 00 00" />
      </div>
      <Field label="Адрес" name="address" placeholder="ул. Ленина 1" />
      {state.error && <p className="text-sm" style={{ color: "#ef4444" }}>{state.error}</p>}
      <NavButtons pending={pending} noBack />
    </form>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [closedDays, setClosedDays] = useState<Record<string, boolean>>({ sun: true })
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    async (prev, fd) => { const r = await saveWorkingHoursAction(prev, fd); if (r.ok) onNext(); return r }, {}
  )
  return (
    <form action={action} className="flex flex-col gap-0.5">
      {DAYS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "#f1f5f9" }}>
          <span className="w-24 text-sm flex-shrink-0" style={{ color: "#020617" }}>{label}</span>
          {closedDays[key] ? (
            <span className="text-xs flex-1" style={{ color: "#94a3b8" }}>Выходной</span>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input name={`${key}_open`} type="time" defaultValue="09:00"
                className="h-8 rounded-md px-2 text-sm outline-none transition-all"
                style={{ border: "1px solid #e2e8f0", color: "#020617" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }} />
              <span className="text-xs" style={{ color: "#94a3b8" }}>—</span>
              <input name={`${key}_close`} type="time" defaultValue="21:00"
                className="h-8 rounded-md px-2 text-sm outline-none transition-all"
                style={{ border: "1px solid #e2e8f0", color: "#020617" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15,23,42,0.07)" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none" }} />
            </div>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 ml-auto select-none">
            <input type="checkbox" name={`${key}_closed`} checked={!!closedDays[key]}
              onChange={(e) => setClosedDays(p => ({ ...p, [key]: e.target.checked }))}
              className="rounded" style={{ accentColor: "#0f172a", width: 14, height: 14 }} />
            <span className="text-xs" style={{ color: "#94a3b8" }}>Вых.</span>
          </label>
        </div>
      ))}
      {state.error && <p className="text-sm mt-2" style={{ color: "#ef4444" }}>{state.error}</p>}
      <NavButtons onBack={onBack} pending={pending} />
    </form>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    async (prev, fd) => { const r = await createFirstMembershipAction(prev, fd); if (r.ok) onNext(); return r }, {}
  )
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Название абонемента" name="name" placeholder="Безлимитный на месяц" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Цена" name="price" placeholder="500 000" money />
        <Field label="Срок (дней)" name="durationDays" type="number" placeholder="30" defaultValue="30" />
      </div>
      <p className="text-xs" style={{ color: "#94a3b8" }}>
        Вы сможете создать больше абонементов позже в разделе «Абонементы»
      </p>
      {state.error && <p className="text-sm" style={{ color: "#ef4444" }}>{state.error}</p>}
      <NavButtons onBack={onBack} pending={pending} />
    </form>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────

function Step4({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("")
  const [sent, setSent]   = useState<string[]>([])
  const [pending, startT] = useTransition()

  function addInvite() {
    if (!email.trim()) return
    startT(async () => { setSent(p => [...p, email.trim()]); setEmail("") })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onFinish() }} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: "#020617", letterSpacing: "-0.084px" }}>
          Email сотрудника
        </label>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="trainer@example.com"
            className="h-10 w-full rounded-md px-3 text-sm outline-none transition-all"
            style={inputStyle} onFocus={focusIn} onBlur={focusOut}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())} />
          <button type="button" onClick={addInvite} disabled={pending || !email.trim()}
            className="flex-shrink-0 h-10 px-4 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: "#0f172a" }}>
            + Добавить
          </button>
        </div>
      </div>

      {sent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sent.map((e) => (
            <div key={e} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ background: "#f8fafc", color: "#020617" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#22c55e" }} />
              {e}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: "#94a3b8" }}>
        Вы можете пропустить этот шаг и добавить сотрудников позже в разделе «Настройки → Сотрудники»
      </p>

      <div className="flex items-center justify-between pt-5 mt-3">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 h-10 px-4 rounded-md text-sm font-medium transition-all hover:bg-slate-50 active:scale-[0.98]"
          style={{ color: "#020617", border: "1px solid #e2e8f0" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onFinish}
            className="h-10 px-4 rounded-md text-sm font-medium transition-all hover:bg-slate-50"
            style={{ color: "#64748b" }}>
            Пропустить
          </button>
          <button type="submit"
            className="flex items-center gap-1.5 h-10 px-5 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#0f172a" }}>
            Перейти в CRM <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Main wizard ───────────────────────────────────────────────────

export function OnboardingWizard({ clubName: _ }: { clubName: string }) {
  const [step, setStep] = useState(1)
  const router = useRouter()
  const current = STEPS[step - 1]

  return (
    <div className="min-h-screen flex">

      {/* Left dark branding panel */}
      <div className="hidden lg:flex flex-col flex-1 bg-[#0f172a] overflow-hidden"
        style={{ maxWidth: "52%", minHeight: "100vh" }}>
        <BrandingCarousel />
      </div>

      {/* Right white panel */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">

        {/* Top bar */}
        <div className="flex items-center justify-between px-9 pt-9">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0f172a" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M7 12H17M12 7V17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "#020617" }}>fitCRM</span>
          </div>
          <button onClick={() => router.push("/dashboard")}
            className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
            style={{ color: "#64748b" }}>
            Пропустить настройку
          </button>
        </div>

        {/* Form area — centered vertically */}
        <div className="flex-1 flex items-center justify-center px-16 pb-6">
          <div className="w-full max-w-[480px]">

            {/* Stepper */}
            <Stepper step={step} />

            {/* Step heading */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold" style={{ color: "#020617", letterSpacing: "-0.144px" }}>
                {current.label}
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "#64748b" }}>{current.sub}</p>
            </div>

            {/* Forms */}
            {step === 1 && <Step1 onNext={() => setStep(2)} />}
            {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
            {step === 4 && <Step4 onFinish={() => router.push("/dashboard")} onBack={() => setStep(3)} />}
          </div>
        </div>

      </div>
    </div>
  )
}
