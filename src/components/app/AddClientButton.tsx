"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/use-action"
import { Plus, X, ChevronDown, Calendar } from "lucide-react"
import { createClientAction, type ClientFormState } from "@/app/(app)/clients/actions"

export type MembershipOption = { id: string; name: string; price: number }
export type TrainerOption = { id: string; name: string }

/* ─── Masking helpers ─── */

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

function dateDigits(v: string) {
  return v.replace(/\D/g, "").slice(0, 8)
}

function displayDate(d: string) {
  if (!d) return ""
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

function rawDateISO(d: string): string {
  if (d.length !== 8) return ""
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

/* ─── Field helpers ─── */

const BASE_INPUT = "h-10 w-full rounded-md text-sm outline-none px-3"
const INPUT_STYLE = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }
const PLACEHOLDER_COLOR = "var(--on-dark-soft)"
const SELECT_CLS = `${BASE_INPUT} appearance-none pr-8`

function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-0.5 text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>
      {children}
      {required && <span style={{ color: "#ef4444" }}>*</span>}
    </div>
  )
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={BASE_INPUT}
      style={INPUT_STYLE}
    />
  )
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: PLACEHOLDER_COLOR }} />
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-base font-medium" style={{ color: "var(--on-dark)" }}>{children}</p>
}

const SOURCE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook",  label: "Facebook / VK" },
  { value: "referral",  label: "Рекомендация" },
  { value: "outdoor",   label: "Наружная реклама" },
  { value: "other",     label: "Другое" },
]

const GENDER_OPTIONS = [
  { value: "male",   label: "Мужской" },
  { value: "female", label: "Женский" },
]

/* ─── Main component ─── */

export function AddClientButton({ memberships, trainers = [] }: { memberships: MembershipOption[]; trainers?: TrainerOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName]   = useState("")
  const [lastName,  setLastName]    = useState("")
  const [phoneDig,  setPhoneDig]    = useState("")
  const [dateDig,   setDateDig]     = useState("")
  const [gender,    setGender]      = useState("")
  const [email,     setEmail]       = useState("")
  const [membershipId, setMembershipId] = useState("")
  const [trainerId, setTrainerId]   = useState("")
  const [source,    setSource]      = useState("")
  const [notes,     setNotes]       = useState("")

  const SINGLE = { id: "single", name: "Разовый (1 занятие)", price: 0 }
  const allMemberships = [SINGLE, ...memberships]

  function reset() {
    setFirstName(""); setLastName(""); setPhoneDig(""); setDateDig("")
    setGender(""); setEmail(""); setMembershipId(""); setTrainerId(""); setSource(""); setNotes("")
    setError(null)
  }

  function close() { setOpen(false); reset() }

  function handleSubmit() {
    if (!firstName.trim()) { setError("Введите имя клиента"); return }
    if (phoneDig.length !== 9) { setError("Введите корректный номер: +998 (XX) XXX-XX-XX"); return }

    const fd = new FormData()
    fd.set("first_name", firstName.trim())
    fd.set("last_name", lastName.trim())
    fd.set("phone", `+998${phoneDig}`)
    fd.set("birth_date", rawDateISO(dateDig))
    fd.set("gender", gender)
    fd.set("email", email.trim())
    fd.set("membership_id", membershipId)
    fd.set("trainer_id", trainerId)
    fd.set("trainer_name", trainers.find((t) => t.id === trainerId)?.name ?? "")
    fd.set("source", source)
    fd.set("notes", notes.trim())

    startTransition(async () => {
      const res: ClientFormState = await createClientAction({}, fd)
      if (res.error) {
        setError(res.error)
        toast.error(res.error)
      } else {
        close()
        toast.success("Клиент создан")
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--on-dark)", color: "var(--bg)" }}
      >
        <Plus className="w-4 h-4" />
        Добавить клиента
      </button>

      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(2,6,23,0.4)" }}>
          {/* Click-outside to close */}
          <div className="absolute inset-0" onClick={close} />

          {/* Drawer panel */}
          <div
            className="absolute top-0 right-0 bottom-0 w-full max-w-[560px] flex flex-col"
            style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-2xl font-semibold" style={{ color: "var(--on-dark)", letterSpacing: "-0.144px" }}>
                Добавление клиента
              </h3>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6 px-6 py-5">

                {/* ── Личные данные ── */}
                <div className="flex flex-col gap-4">
                  <SectionTitle>Личные данные</SectionTitle>

                  {/* Имя */}
                  <div>
                    <Label required>Имя</Label>
                    <StyledInput
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Введите имя"
                      autoFocus
                    />
                  </div>

                  {/* Фамилия */}
                  <div>
                    <Label required>Фамилия</Label>
                    <StyledInput
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Введите фамилию"
                    />
                  </div>

                  {/* Номер телефона */}
                  <div>
                    <Label required>Номер телефона</Label>
                    <input
                      className={BASE_INPUT}
                      style={INPUT_STYLE}
                      value={displayPhone(phoneDig)}
                      placeholder="+998 (__) ___-__-__"
                      onChange={(e) => setPhoneDig(phoneDigits(e.target.value))}
                      inputMode="numeric"
                    />
                  </div>

                  {/* Дата рождения + Пол */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Дата рождения</Label>
                      <div className="relative">
                        <input
                          className={BASE_INPUT}
                          style={INPUT_STYLE}
                          value={displayDate(dateDig)}
                          placeholder="дд.мм.гггг"
                          onChange={(e) => setDateDig(dateDigits(e.target.value))}
                          inputMode="numeric"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: PLACEHOLDER_COLOR }} />
                      </div>
                    </div>
                    <div>
                      <Label required>Пол</Label>
                      <SelectWrapper>
                        <select
                          className={SELECT_CLS}
                          style={{ ...INPUT_STYLE, color: gender ? "var(--on-dark)" : PLACEHOLDER_COLOR }}
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                        >
                          <option value="">Выберите пол</option>
                          {GENDER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* E-mail */}
                  <div>
                    <Label>E-mail</Label>
                    <StyledInput
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@gmail.com"
                    />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* ── Абонемент и тренировки ── */}
                <div className="flex flex-col gap-4">
                  <SectionTitle>Абонемент и тренировки</SectionTitle>

                  {/* Абонемент */}
                  <div>
                    <Label required>Абонемент</Label>
                    <SelectWrapper>
                      <select
                        className={SELECT_CLS}
                        style={{ ...INPUT_STYLE, color: membershipId ? "var(--on-dark)" : PLACEHOLDER_COLOR }}
                        value={membershipId}
                        onChange={(e) => setMembershipId(e.target.value)}
                      >
                        <option value="">Выберите абонемент</option>
                        {allMemberships.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}{m.price > 0 ? ` — ${m.price.toLocaleString("ru-RU")} сум` : ""}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </div>

                  {/* Персональный тренер */}
                  <div>
                    <Label>Персональный тренер</Label>
                    <SelectWrapper>
                      <select
                        className={SELECT_CLS}
                        style={{ ...INPUT_STYLE, color: trainerId ? "var(--on-dark)" : PLACEHOLDER_COLOR }}
                        value={trainerId}
                        onChange={(e) => setTrainerId(e.target.value)}
                        disabled={trainers.length === 0}
                      >
                        <option value="">{trainers.length === 0 ? "Нет тренеров" : "Выберите тренера"}</option>
                        {trainers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* ── Дополнительная информация ── */}
                <div className="flex flex-col gap-4">
                  <SectionTitle>Дополнительная информация</SectionTitle>

                  {/* Источник */}
                  <div>
                    <Label>Источник</Label>
                    <SelectWrapper>
                      <select
                        className={SELECT_CLS}
                        style={{ ...INPUT_STYLE, color: source ? "var(--on-dark)" : PLACEHOLDER_COLOR }}
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      >
                        <option value="">Выберите источник</option>
                        {SOURCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </div>

                  {/* Комментарий */}
                  <div>
                    <Label>Комментарий</Label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Введите комментарий..."
                      rows={4}
                      className="w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              {error && (
                <p className="text-sm w-full" style={{ color: "#dc2626" }}>{error}</p>
              )}
              {!error && (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={pending}
                    className="flex-1 h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--on-dark)" }}
                  >
                    {pending ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button
                    onClick={close}
                    className="flex-1 h-11 rounded-md text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                  >
                    Отмена
                  </button>
                </>
              )}
              {error && (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setError(null)}
                    className="flex-1 h-11 rounded-md text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={pending}
                    className="flex-1 h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--on-dark)" }}
                  >
                    Повторить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
