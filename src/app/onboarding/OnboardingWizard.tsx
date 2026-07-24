"use client"

import { useState, useActionState, useTransition, startTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Building2, Clock, CreditCard, Users, ArrowLeft, ArrowRight, Check, Plus } from "lucide-react"
import { BrandingCarousel } from "@/app/(auth)/BrandingCarousel"
import { inviteStaffAction } from "@/app/(app)/settings/club/actions"
import { saveClubInfoAction, saveWorkingHoursAction, createFirstMembershipAction, completeOnboardingAction, type OnboardingState } from "./actions"
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

const ONBOARDING_INPUT_CLASS =
  "border-foreground/15 bg-background/30 shadow-none backdrop-blur-sm focus-visible:bg-background/50"

const ONBOARDING_SECONDARY_BUTTON_CLASS =
  "border-background/35 bg-background/20 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/30 hover:text-foreground"

const ONBOARDING_SKIP_BUTTON_CLASS =
  "border border-background/25 bg-background/15 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/25 hover:text-foreground"

function Field({ label, name, placeholder, type = "text", defaultValue, autoFocus, money }: {
  label: string; name: string; placeholder?: string
  type?: string; defaultValue?: string; autoFocus?: boolean; money?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[15px] font-medium text-foreground" htmlFor={name}>{label}</label>
      {money ? (
        <MoneyInput
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`h-11 w-full rounded-lg px-3 text-base text-foreground outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${ONBOARDING_INPUT_CLASS}`}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          className={`h-11 text-base ${ONBOARDING_INPUT_CLASS}`}
        />
      )}
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const current = STEPS[step - 1]

  return (
    <div className="mb-7 space-y-4">
      <div className="flex items-center justify-between text-sm text-foreground/75">
        <span>Шаг {step} из {STEPS.length}</span>
        <span className="font-medium text-foreground">{current.short}</span>
      </div>
      <ol className="flex items-center gap-2.5" aria-label="Этапы настройки клуба">
      {STEPS.map((s, i) => {
        const done   = step > s.id
        const active = step === s.id
        const Icon   = s.Icon
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2.5 last:flex-none" aria-current={active ? "step" : undefined}>
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${done || active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
              aria-label={s.label}
            >
              {done ? <Check className="size-[18px]" /> : <Icon className="size-[18px]" />}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 min-w-2 flex-1 rounded-full ${done ? "bg-primary" : "bg-border"}`} />
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
    <div className="mt-7 flex flex-col-reverse gap-2.5">
      {!noBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className={`h-11 w-full text-base ${ONBOARDING_SECONDARY_BUTTON_CLASS}`}
        >
          <ArrowLeft className="size-4" /> Назад
        </Button>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
        {pending ? "Сохранение…" : nextLabel} {!pending && <ArrowRight className="size-4" />}
      </Button>
    </div>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────

function Step1({ onNext, clubName }: { onNext: () => void; clubName: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    async (prev, fd) => { const r = await saveClubInfoAction(prev, fd); if (r.ok) onNext(); return r }, {}
  )
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Название клуба" name="name" placeholder="PowerGym" defaultValue={clubName} autoFocus />
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
              <Input name={`${key}_open`} type="time" defaultValue="09:00" className={`h-10 min-w-0 px-2 ${ONBOARDING_INPUT_CLASS}`} aria-label={`${label}: время открытия`} />
              <span className="text-xs text-muted-foreground">до</span>
              <Input name={`${key}_close`} type="time" defaultValue="21:00" className={`h-10 min-w-0 px-2 ${ONBOARDING_INPUT_CLASS}`} aria-label={`${label}: время закрытия`} />
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
  const [error, setError] = useState("")
  const [pending, startT] = useTransition()

  function addInvite() {
    if (!email.trim()) return
    startT(async () => {
      setError("")
      const normalizedEmail = email.trim().toLowerCase()
      const result = await inviteStaffAction({ email: normalizedEmail, role: "trainer" })
      if (result.error) {
        setError(result.error)
        return
      }
      setSent((previous) => [...previous, normalizedEmail])
      setEmail("")
    })
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
            className={ONBOARDING_INPUT_CLASS}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())} />
          <Button type="button" onClick={addInvite} disabled={pending || !email.trim()} className="h-10 w-full sm:w-auto">
            <Plus className="size-4" /> Отправить приглашение
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

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Вы можете пропустить этот шаг и добавить сотрудников позже в разделе «Настройки → Сотрудники»
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className={`h-11 w-full text-base sm:w-auto ${ONBOARDING_SECONDARY_BUTTON_CLASS}`}
        >
          <ArrowLeft className="size-4" /> Назад
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={onFinish}
            className={`h-11 w-full px-4 text-base sm:w-auto ${ONBOARDING_SKIP_BUTTON_CLASS}`}
          >
            Без приглашений
          </Button>
          <Button type="submit" size="lg" className="h-11 w-full text-base sm:w-auto">
            Перейти в CRM <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}

// ── Main wizard ───────────────────────────────────────────────────

export function OnboardingWizard({ clubName, initialStep }: { clubName: string; initialStep: number }) {
  const [step, setStep] = useState(initialStep)
  const router = useRouter()
  const current = STEPS[step - 1]

  function finish() {
    startTransition(async () => {
      const result = await completeOnboardingAction()
      if (result.ok) router.push("/dashboard")
    })
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 clouds-anim">
          <Image
            src="/screens/clouds.jpg"
            alt=""
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
          />
        </div>
      </div>

      {/* Left branding panel */}
      <div className="relative z-10 hidden h-full min-h-0 w-1/2 flex-none flex-col overflow-hidden bg-foreground/45 lg:flex">
        <div className="relative z-10 h-full min-h-0 w-full">
          <BrandingCarousel />
        </div>
      </div>

      {/* Right cloud panel */}
      <main className="relative z-10 flex h-full min-h-0 w-full flex-none flex-col bg-foreground/45 lg:w-1/2">
        <div className="dark relative z-10 m-3 flex min-h-0 flex-1 flex-col overflow-auto rounded-3xl bg-background/25 shadow-2xl shadow-foreground/20 ring-1 ring-background/35 backdrop-blur-md backdrop-brightness-90 backdrop-saturate-75 lg:m-5">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-8 lg:px-9 lg:pt-9">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Plus className="size-4" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-foreground">fitCRM</span>
            </div>
            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={finish}
                className={`h-9 px-3 text-sm font-semibold ${ONBOARDING_SKIP_BUTTON_CLASS}`}
              >
                Завершить позже
              </Button>
            )}
          </div>

          {/* Form area — centered vertically */}
          <div className="flex flex-1 items-start justify-center px-4 py-4 pb-6 sm:px-8 sm:py-8 lg:items-center lg:px-12 xl:px-16">
            <section className="w-full max-w-[480px] rounded-2xl border border-background/15 bg-background/15 p-4 shadow-xl shadow-foreground/10 backdrop-blur-sm sm:p-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">

              {/* Stepper */}
              <Stepper step={step} />

              {/* Step heading */}
              <div className="mb-7">
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  {current.label}
                </h1>
                <p className="mt-2 text-base text-muted-foreground">{current.sub}</p>
              </div>

              {/* Forms */}
              {step === 1 && <Step1 clubName={clubName} onNext={() => setStep(2)} />}
              {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
              {step === 4 && <Step4 onFinish={finish} onBack={() => setStep(3)} />}
            </section>
          </div>
        </div>

      </main>
    </div>
  )
}
