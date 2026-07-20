"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "@/lib/use-action"
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  User, Users, CalendarDays, Wallet, Shield, BarChart2,
} from "lucide-react"
import { type StaffDetail, ROLE_LABELS } from "@/lib/staff"
import {
  updateStaffBasicAction,
  updateStaffSalaryAction,
  payStaffAction,
  updateStaffPermissionsAction,
  updateStaffStatusAction,
  updateStaffRoleAction,
} from "@/app/(app)/staff/actions"
import { MoneyInput } from "./MoneyInput"

type SimpleRole = { id: string; key: string; name: string; isSystem: boolean }

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("ru-RU") }
function fmtDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const STATUS_META = {
  active:   { label: "Активен",  bg: "rgba(22,163,74,0.14)", color: "#16a34a" },
  vacation: { label: "Отпуск",   bg: "rgba(202,138,4,0.14)", color: "#ca8a04" },
  fired:    { label: "Уволен",   bg: "rgba(220,38,38,0.14)", color: "#dc2626" },
}

const DAY_LABELS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]

// ── UI Primitives ─────────────────────────────────────────────────

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-shadow"
      style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)" }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
    />
  )
}

function SaveBtn({ pending, saved, label = "Сохранить" }: { pending: boolean; saved: boolean; label?: string }) {
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "#2563eb" }}>
      {saved ? <><Check className="w-4 h-4" />Сохранено</> : pending ? "Сохранение..." : label}
    </button>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-10 h-6 rounded-full transition-colors flex-shrink-0 relative"
      style={{ background: checked ? "#2563eb" : "var(--border)" }}>
      <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? "22px" : "2px" }} />
    </button>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: accent + "18", border: `1px solid ${accent}30` }}>
      <p className="text-xs font-medium mb-1" style={{ color: accent }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "var(--on-dark)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{sub}</p>}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────

type Tab = "basic" | "clients" | "schedule" | "salary" | "permissions" | "performance"

const TABS: { key: Tab; label: string; icon: typeof User; roles?: string[] }[] = [
  { key: "basic",       label: "Основное",         icon: User },
  { key: "clients",     label: "Клиенты",           icon: Users,       roles: ["trainer"] },
  { key: "schedule",    label: "Расписание",        icon: CalendarDays, roles: ["trainer"] },
  { key: "salary",      label: "Зарплата",          icon: Wallet },
  { key: "permissions", label: "Доступы",           icon: Shield },
  { key: "performance", label: "Производительность", icon: BarChart2 },
]

// ── Section Components ────────────────────────────────────────────

function BasicSection({
  member, roles, canManageRoles,
}: {
  member: StaffDetail
  roles: SimpleRole[]
  canManageRoles: boolean
}) {
  const s = member.settings
  const [name, setName]     = useState(member.name)
  const [phone, setPhone]   = useState(s.phone ?? "")
  const [dob, setDob]       = useState(s.dob ?? "")
  const [hired, setHired]   = useState(s.hired_at ?? "")
  const [role, setRole]     = useState(member.role)
  const [status, setStatus] = useState(member.status)
  const [saved, setSaved]   = useState(false)
  const [roleSaved, setRoleSaved] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [pending, start]    = useTransition()
  const [, stStart] = useTransition()
  const [rolePending, roleStart] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    start(async () => {
      const res = await updateStaffBasicAction(member.id, { name, phone, dob, hiredAt: hired, role })
      if (res.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  function handleStatus(s: string) {
    const prev = status
    setStatus(s as typeof status)   // оптимистично
    stStart(async () => {
      const res = await updateStaffStatusAction(member.id, s)
      if (res?.error) { setStatus(prev); toast.error(res.error) }   // откат при ошибке
    })
  }

  function handleRoleChange(roleKey: string) {
    if (!canManageRoles || roleKey === role) return
    setRole(roleKey)
    roleStart(async () => {
      await updateStaffRoleAction(member.id, roleKey)
      setRoleSaved(true)
      setTimeout(() => setRoleSaved(false), 2000)
    })
  }

  const sm = STATUS_META[status] ?? STATUS_META.active

  // current role display name
  const currentRoleName = roles.find((r) => r.key === role)?.name ?? ROLE_LABELS[role] ?? role

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Личные данные" action={
        <div className="relative">
          <button type="button" className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ border: "1px solid var(--border)", background: sm.bg, color: sm.color }}
            onClick={(e) => {
              const m = e.currentTarget.nextElementSibling as HTMLElement
              m.style.display = m.style.display === "block" ? "none" : "block"
            }}>
            {sm.label} <ChevronDown className="w-3 h-3" />
          </button>
          <div className="absolute right-0 top-full mt-1 z-20 rounded-xl py-1 hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", minWidth: "140px" }}>
            {(["active","vacation","fired"] as const).map((s) => (
              <button key={s} type="button" onClick={() => { handleStatus(s); (document.activeElement as HTMLElement)?.blur() }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                style={{ color: STATUS_META[s].color }}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      }>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: "#3b82f6" }}>
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>{member.name}</p>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{member.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Полное имя"><Input value={name} onChange={setName} placeholder="Азиз Каримов" /></Field>
          <Field label="Телефон"><Input value={phone} onChange={setPhone} placeholder="+998 90 000 00 00" type="tel" /></Field>
          <Field label="Дата рождения"><Input value={dob} onChange={setDob} type="date" placeholder="" /></Field>
          <Field label="Дата приема"><Input value={hired} onChange={setHired} type="date" placeholder="" /></Field>
        </div>
      </Card>

      {/* Role card */}
      <Card title="Роль">
        <div className="space-y-3">
          {/* Current role */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--gray-muted)" }}>Текущая роль</p>
              <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{currentRoleName}</p>
            </div>
            {rolePending && <span className="text-xs" style={{ color: "var(--gray-muted)" }}>Сохранение...</span>}
            {roleSaved && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#16a34a" }}>
                <Check className="w-3.5 h-3.5" /> Сохранено
              </span>
            )}
          </div>

          {canManageRoles && (
            <>
              {/* Role grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => handleRoleChange(r.key)}
                    disabled={rolePending}
                    className="flex flex-col items-start p-3 rounded-lg text-left transition-all disabled:opacity-60"
                    style={{
                      border: `1.5px solid ${role === r.key ? "#2563eb" : "var(--border)"}`,
                      background: role === r.key ? "rgba(37,99,235,0.08)" : "var(--card)",
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: role === r.key ? "#2563eb" : "var(--on-dark)" }}>
                      {r.name}
                    </span>
                    {r.isSystem && (
                      <span className="text-[10px] mt-0.5" style={{ color: "var(--gray-muted)" }}>Системная</span>
                    )}
                    {!r.isSystem && (
                      <span className="text-[10px] mt-0.5" style={{ color: "#7c3aed" }}>Кастомная</span>
                    )}
                    {role === r.key && (
                      <Check className="w-3 h-3 mt-1 self-end" style={{ color: "#2563eb" }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Manual/custom role button */}
              <Link
                href={`/settings/roles?staffId=${member.id}&staffName=${encodeURIComponent(member.name)}`}
                className="flex items-center justify-between w-full p-3 rounded-lg transition-colors hover:opacity-80"
                style={{ border: "1px dashed var(--border)", color: "var(--on-dark-soft)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>Назначить в ручную</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Создать персональную роль с настройкой прав</p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              </Link>
            </>
          )}
        </div>
      </Card>

      {error && <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>}
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

function ClientsSection({ member }: { member: StaffDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Активных клиентов" value={String(member.clientCount)} accent="#2563eb" />
        <StatCard label="Проведено занятий" value={String(member.personalCount)} accent="#7c3aed" />
        <StatCard label="Доход" value={`${fmt(member.personalRevenue)} сум`} accent="#059669" />
        <StatCard label="Продлений" value={String(member.renewals)} accent="#d97706" />
      </div>

      <Card title={`Клиенты тренера (${member.clients.length})`}>
        {member.clients.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--gray-muted)" }}>Нет закреплённых клиентов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Клиент","Абонемент","Статус"].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {member.clients.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-2 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline" style={{ color: "var(--on-dark)" }}>{c.name}</Link>
                    </td>
                    <td className="px-2 py-3" style={{ color: "var(--on-dark-soft)" }}>{c.membershipName ?? "—"}</td>
                    <td className="px-2 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: c.status === "active" ? "rgba(22,163,74,0.14)" : "var(--card-2)", color: c.status === "active" ? "#16a34a" : "var(--on-dark-soft)" }}>
                        {c.status === "active" ? "Активен" : c.status === "expired" ? "Истёк" : c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function ScheduleSection({ member }: { member: StaffDetail }) {
  const byDay = DAY_LABELS.map((_, i) =>
    member.schedule.filter((s) => s.dayOfWeek === (i + 1) % 7)
  )

  return (
    <Card title="Расписание тренировок">
      {member.schedule.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--gray-muted)" }}>Расписание не настроено</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((day, i) => (
            <div key={day}>
              <p className="text-xs font-semibold text-center mb-2" style={{ color: "var(--on-dark-soft)" }}>{day}</p>
              <div className="space-y-1.5">
                {byDay[i].length === 0 ? (
                  <div className="h-14 rounded-lg" style={{ background: "var(--bg)" }} />
                ) : (
                  byDay[i].map((slot) => (
                    <div key={slot.id} className="p-2 rounded-lg text-center" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      <p className="text-xs font-semibold truncate" style={{ color: "#2563eb" }}>{slot.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{slot.startTime.slice(0,5)}–{slot.endTime.slice(0,5)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function SalarySection({ member }: { member: StaffDetail }) {
  const s = member.settings
  const [salType, setSalType]   = useState<"none" | "fixed" | "percent" | "mixed">(s.salary_type ?? "fixed")
  const [fixed, setFixed]       = useState(String(s.salary_fixed ?? member.salary ?? 0))
  const [pct, setPct]           = useState(String(s.salary_percent ?? 20))
  const [payAmount, setPayAmount] = useState(String(s.salary_fixed ?? member.salary ?? 0))
  const [payNote, setPayNote]   = useState("")
  const [showPay, setShowPay]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [payDone, setPayDone]   = useState(false)
  const [pending, start]        = useTransition()
  const [payPending, payStart]  = useTransition()
  const history = s.salary_history ?? []

  const fixedNum  = Number(fixed) || 0
  const pctNum    = Number(pct) || 0
  const revenue   = member.personalRevenue || 0
  const pctAmount = Math.round(revenue * pctNum / 100)
  const total     = salType === "none" ? 0 : salType === "fixed" ? fixedNum : salType === "percent" ? pctAmount : fixedNum + pctAmount

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      await updateStaffSalaryAction(member.id, { salaryType: salType, salaryFixed: fixedNum, salaryPercent: pctNum })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    payStart(async () => {
      await payStaffAction(member.id, Number(payAmount), payNote || `Выплата ${new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}`)
      setPayDone(true); setShowPay(false)
      setTimeout(() => setPayDone(false), 3000)
    })
  }

  const SALARY_TYPES = [
    { key: "none",    label: "Без зарплаты" },
    { key: "fixed",   label: "Фикс" },
    { key: "percent", label: "Процент" },
    { key: "mixed",   label: "Фикс + Процент" },
  ]

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave}>
        <Card title="Настройка зарплаты" action={<SaveBtn pending={pending} saved={saved} />}>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--on-dark-soft)" }}>Тип оплаты</label>
              <div className="grid grid-cols-2 gap-2">
                {SALARY_TYPES.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setSalType(key as "none" | "fixed" | "percent" | "mixed")}
                    className="h-9 rounded-lg text-xs font-medium transition-all"
                    style={{
                      border: `1.5px solid ${salType === key ? "#2563eb" : "var(--border)"}`,
                      background: salType === key ? "rgba(37,99,235,0.12)" : "var(--card)",
                      color: salType === key ? "#2563eb" : "var(--on-dark-soft)",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(salType === "fixed" || salType === "mixed") && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Фикс</label>
                  <MoneyInput value={fixed} onChange={(n) => setFixed(String(n))} placeholder="4 000 000"
                    className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </div>
              )}
              {(salType === "percent" || salType === "mixed") && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Процент (%)</label>
                  <input value={pct} onChange={(e) => setPct(e.target.value)} type="number" placeholder="20"
                    className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </div>
              )}
            </div>

            {/* Auto-calculation */}
            <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-muted)" }}>Автоматический расчёт</p>
              {(salType === "fixed" || salType === "mixed") && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Фикс:</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{fmt(fixedNum)} сум</span>
                </div>
              )}
              {(salType === "percent" || salType === "mixed") && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Персоналки ({pct}%):</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{fmt(pctAmount)} сум</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Итого:</span>
                <span className="text-base font-bold" style={{ color: "#2563eb" }}>{fmt(total)} сум</span>
              </div>
            </div>
          </div>
        </Card>
      </form>

      {/* Pay button */}
      <div className="flex items-center gap-3">
        <button onClick={() => setShowPay(true)}
          className="h-10 px-6 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ background: "#059669" }}>
          <Wallet className="w-4 h-4" /> Выплатить зарплату
        </button>
        {payDone && <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: "#16a34a" }}><Check className="w-4 h-4" />Выплата записана</span>}
      </div>

      {showPay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.4)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "var(--card)" }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Выплата зарплаты</h2>
              <button onClick={() => setShowPay(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--gray-muted)" }}>✕</button>
            </div>
            <form onSubmit={handlePay} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Сумма</label>
                <MoneyInput value={payAmount} onChange={(n) => setPayAmount(String(n))}
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Комментарий</label>
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Май 2026"
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPay(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                  Отмена
                </button>
                <button type="submit" disabled={payPending || !payAmount}
                  className="flex-1 h-10 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "#059669" }}>
                  {payPending ? "..." : "Выплатить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      <Card title="История выплат">
        {history.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--gray-muted)" }}>Выплат ещё нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Дата","Сумма","Комментарий"].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-2 py-3" style={{ color: "var(--on-dark-soft)" }}>{fmtDate(h.date)}</td>
                    <td className="px-2 py-3 font-semibold" style={{ color: "var(--on-dark)" }}>{fmt(h.amount)} сум</td>
                    <td className="px-2 py-3" style={{ color: "var(--on-dark-soft)" }}>{h.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

const PERM_LABELS: { key: string; label: string; desc: string }[] = [
  { key: "clients",   label: "Клиенты",    desc: "Просмотр и редактирование клиентов" },
  { key: "visits",    label: "Посещения",  desc: "Отметка посещений" },
  { key: "payments",  label: "Платежи",    desc: "Просмотр и создание платежей" },
  { key: "inventory", label: "Склад",      desc: "Управление товарами и остатками" },
  { key: "finance",   label: "Финансы",    desc: "Отчёты и финансовая статистика" },
  { key: "settings",  label: "Настройки",  desc: "Изменение настроек клуба" },
]

function PermissionsSection({ member }: { member: StaffDetail }) {
  const def = member.settings.permissions ?? {}
  const [perms, setPerms] = useState<Record<string, boolean>>(
    Object.fromEntries(PERM_LABELS.map(({ key }) => [key, def[key as keyof typeof def] ?? false]))
  )
  const [saved, setSaved]  = useState(false)
  const [pending, start]   = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      await updateStaffPermissionsAction(member.id, perms)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Card title="Права доступа">
        <div className="space-y-4">
          {PERM_LABELS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{desc}</p>
              </div>
              <Toggle checked={perms[key] ?? false} onChange={(v) => setPerms((p) => ({ ...p, [key]: v }))} />
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

function PerformanceSection({ member }: { member: StaffDetail }) {
  const isTrainer = member.role === "trainer"

  if (isTrainer) {
    const stats = [
      { label: "Активных клиентов", value: String(member.clientCount), accent: "#2563eb" },
      { label: "Проведено персоналок", value: String(member.personalCount), accent: "#7c3aed" },
      { label: "Продлений абонементов", value: String(member.renewals), accent: "#059669" },
      { label: "Доход от персоналок", value: `${fmt(member.personalRevenue)} сум`, accent: "#d97706" },
    ]
    return (
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
    )
  }

  // Admin/Manager performance
  const stats = [
    { label: "Оформлено клиентов", value: "—", accent: "#2563eb" },
    { label: "Продано абонементов", value: "—", accent: "#7c3aed" },
    { label: "Продлений",          value: "—", accent: "#059669" },
    { label: "Платежей принято",    value: "—", accent: "#d97706" },
  ]
  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export function StaffProfileClient({
  member,
  roles = [],
  canManageRoles = false,
}: {
  member: StaffDetail
  roles?: SimpleRole[]
  canManageRoles?: boolean
}) {
  const [tab, setTab] = useState<Tab>("basic")

  const visibleTabs = TABS.filter((t) => !t.roles || t.roles.includes(member.role))

  const sm = STATUS_META[member.status] ?? STATUS_META.active

  const renderTab = () => {
    switch (tab) {
      case "basic":       return <BasicSection member={member} roles={roles} canManageRoles={canManageRoles} />
      case "clients":     return <ClientsSection member={member} />
      case "schedule":    return <ScheduleSection member={member} />
      case "salary":      return <SalarySection member={member} />
      case "permissions": return <PermissionsSection member={member} />
      case "performance": return <PerformanceSection member={member} />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/staff" className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: "#3b82f6" }}>
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: "var(--on-dark)" }}>{member.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sm.bg, color: sm.color }}>
                {sm.label}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{member.email}</p>
            {member.settings.phone && <p className="text-sm" style={{ color: "var(--gray-muted)" }}>{member.settings.phone}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs" style={{ color: "var(--gray-muted)" }}>Работает с</p>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>
              {member.settings.hired_at ? new Date(member.settings.hired_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Клиентов",     value: String(member.clientCount) },
          { label: "Занятий",      value: String(member.personalCount) },
          { label: "Зарплата",     value: `${fmt(member.salary)} сум` },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-xl text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--on-dark)" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1"
        style={{ borderBottom: "2px solid var(--border-subtle)" }}>
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium whitespace-nowrap transition-colors relative flex-shrink-0"
            style={{ color: tab === key ? "#2563eb" : "var(--on-dark-soft)" }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tab === key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "#2563eb", marginBottom: "-2px" }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {renderTab()}
    </div>
  )
}
