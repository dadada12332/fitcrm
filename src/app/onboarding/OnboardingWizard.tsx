"use client"

import { useState, useActionState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Clock, CreditCard, Users, ArrowLeft, ArrowRight, Check, Plus } from "lucide-react"
import { BrandingCarousel } from "@/app/(auth)/BrandingCarousel"
import { saveClubInfoAction, saveWorkingHoursAction, createFirstMembershipAction, type OnboardingState } from "./actions"
import { MoneyInput } from "@/components/app/MoneyInput"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

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

function Field({ label, name, placeholder, type = "text", defaultValue, autoFocus, money }: {
  label: string; name: string; placeholder?: string
  type?: string; defaultValue?: string; autoFocus?: boolean; money?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={name}>{label}</label>
      {money ? (
        <MoneyInput
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
        />
      ) : (
        <Input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} autoFocus={autoFocus} />
      )}
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const current = STEPS[step - 1]

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Шаг {step} из {STEPS.length}</span>
        <span className="font-medium text-foreground">{current.short}</span>
      </div>
      <ol className="flex items-center gap-2" aria-label="Этапы настройки клуба">
      {STEPS.map((s, i) => {
        const done   = step > s.id
        const active = step === s.id
        const Icon   = s.Icon
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none" aria-current={active ? "step" : undefined}>
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${done || active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
              aria-label={s.label}
            >
              {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px min-w-2 flex-1 ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </li>
        )
      })}
      </ol>
    </div>
  )
}

// ── Nav buttons ───────────────────────────────────────────────────

function NavButtons({ onBack, pending, nextLabel = "Далее", noBack }: {
  onBack?: () => void; pending?: boolean; nextLabel?: string; noBack?: boolean
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      {!noBack ? (
        <Button type="button" variant="outline" onClick={onBack} className="h-10 w-full sm:w-auto">
          <ArrowLeft className="size-4" /> Назад
        </Button>
      ) : <span className="hidden sm:block" />}
      <Button type="submit" size="lg" disabled={pending} className="h-10 w-full sm:w-auto">
        {pending ? "Сохранение…" : nextLabel} {!pending && <ArrowRight className="size-3.5" />}
      </Button>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <Field label="Город" name="city" placeholder="Ташкент" />
        <Field label="Телефон" name="phone" type="tel" placeholder="+998 90 000 00 00" />
      </div>
      <Field label="Адрес" name="address" placeholder="ул. Ленина 1" />
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
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
    <form action={action} className="flex flex-col">
      {DAYS.map(({ key, label }) => (
        <div key={key} className="border-b border-border py-3 last:border-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                name={`${key}_closed`}
                checked={Boolean(closedDays[key])}
                onCheckedChange={(checked) => setClosedDays((prev) => ({ ...prev, [key]: checked }))}
                aria-label={`${label}: выходной`}
              />
              Выходной
            </label>
          </div>
          {closedDays[key] ? (
            <p className="mt-2 text-xs text-muted-foreground">Клуб закрыт</p>
          ) : (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <Input name={`${key}_open`} type="time" defaultValue="09:00" className="h-10 min-w-0 px-2" aria-label={`${label}: время открытия`} />
              <span className="text-xs text-muted-foreground">до</span>
              <Input name={`${key}_close`} type="time" defaultValue="21:00" className="h-10 min-w-0 px-2" aria-label={`${label}: время закрытия`} />
            </div>
          )}
        </div>
      ))}
      {state.error && <p className="mt-3 text-sm text-destructive" role="alert">{state.error}</p>}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <Field label="Цена" name="price" placeholder="500 000" money />
        <Field label="Срок (дней)" name="durationDays" type="number" placeholder="30" defaultValue="30" />
      </div>
      <p className="text-xs text-muted-foreground">
        Вы сможете создать больше абонементов позже в разделе «Абонементы»
      </p>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
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
        <label className="text-sm font-medium text-foreground" htmlFor="staff-email">
          Email сотрудника
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="trainer@example.com"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())} />
          <Button type="button" onClick={addInvite} disabled={pending || !email.trim()} className="h-10 w-full sm:w-auto">
            <Plus className="size-4" /> Добавить
          </Button>
        </div>
      </div>

      {sent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sent.map((e) => (
            <div key={e} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <Check className="size-4 shrink-0 text-brand" />
              {e}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Вы можете пропустить этот шаг и добавить сотрудников позже в разделе «Настройки → Сотрудники»
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="h-10 w-full sm:w-auto">
          <ArrowLeft className="size-4" /> Назад
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onFinish} className="h-10 w-full sm:w-auto">
            Пропустить
          </Button>
          <Button type="submit" size="lg" className="h-10 w-full sm:w-auto">
            Перейти в CRM <ArrowRight className="size-4" />
          </Button>
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
    <div className="min-h-svh bg-background lg:flex">

      {/* Left dark branding panel */}
      <div className="hidden min-h-svh max-w-[52%] flex-1 flex-col overflow-hidden bg-foreground lg:flex">
        <BrandingCarousel />
      </div>

      {/* Right white panel */}
      <main className="flex min-h-svh flex-1 flex-col bg-background">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-8 lg:px-9 lg:pt-9">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Plus className="size-4" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-foreground">fitCRM</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="h-8">
            Пропустить настройку
          </Button>
        </div>

        {/* Form area — centered vertically */}
        <div className="flex flex-1 items-start justify-center px-4 py-4 pb-6 sm:px-8 sm:py-8 lg:items-center lg:px-16">
          <section className="w-full max-w-[480px] rounded-lg border border-border bg-card p-4 shadow-xs sm:p-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">

            {/* Stepper */}
            <Stepper step={step} />

            {/* Step heading */}
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                {current.label}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{current.sub}</p>
            </div>

            {/* Forms */}
            {step === 1 && <Step1 onNext={() => setStep(2)} />}
            {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
            {step === 4 && <Step4 onFinish={() => router.push("/dashboard")} onBack={() => setStep(3)} />}
          </section>
        </div>

      </main>
    </div>
  )
}
