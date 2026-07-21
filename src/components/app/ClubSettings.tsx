"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Crown, Check, X, Plus, ArrowRight,
  MessageCircle, Eye, EyeOff, LogOut,
  Pencil, Trash2,
} from "lucide-react"
import {
  saveClubBasicAction,
  saveFinanceAction,
  changePasswordAction,
  signOutOtherSessionsAction,
  inviteStaffAction,
  createBranchAction,
  createInviteLinkAction,
  updateStaffRoleAction,
  removeStaffAction,
  requestPlanAction,
  cancelPlanRequestAction,
  requestPaymentConnectionAction,
  cancelPaymentConnectionAction,
} from "@/app/(app)/settings/club/actions"
import { saveTelegramSettingsAction } from "@/app/(app)/integrations/actions"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"
import { getBranchesAction, switchBranchAction } from "@/app/(app)/actions"
import { fmtMoney } from "@/lib/money"
import { runAction } from "@/lib/use-action"

export type ClubData = {
  generatedAt: number
  id: string
  name: string
  plan: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  currentRole: string
  settings: {
    address?: string
    phone?: string
    email?: string
    website?: string
    timezone?: string
    currency?: string
    working_hours?: Record<string, { open: string; close: string; closed: boolean }>
    tg_settings?: Partial<TelegramSettings>
    branches?: { name: string; address: string }[]
    finance?: { methods: string[] }
  }
  staffList: { id: string; name: string; role: string; email: string; isMe: boolean }[]
  pendingRequest?: { plan: string; months: number; amount: number | null; createdAt: string } | null
  plans?: PlanForClient[]
  planPriceLocked?: number | null
  /** Статус подключения платёжек: провайдер → статус последней заявки (new/active). */
  paymentConnections?: Record<string, "new" | "active">
  clientCount: number
}

/** Тариф для отображения в CRM (данные из раздела «Тарифы» Platform Admin). */
export type PlanForClient = {
  code: string
  name: string
  price: number
  currency: string
  period: string
  isTrial: boolean
  isActive: boolean
  isPopular: boolean
  color: string
  subtitle: string
  benefits: string[]
  clients: number | null
  staff: number | null
}

type Section = "basic" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "security" | "plan"

const PLAN_LABELS: Record<string, string> = {
  trial: "Пробный", starter: "Starter", standard: "Standard", business: "Business",
}

// ── UI Primitives ────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-shadow disabled:opacity-50"
      style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: disabled ? "var(--bg)" : "var(--card)" }}
      onFocus={(e) => { if (!disabled) { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)" } }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
    />
  )
}

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

function Btn({ onClick, children, variant = "primary", disabled, type = "button", small }: {
  onClick?: () => void; children: React.ReactNode; variant?: "primary" | "secondary" | "danger";
  disabled?: boolean; type?: "button" | "submit"; small?: boolean
}) {
  const base = small ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: "#2563eb", color: "white" },
    secondary: { border: "1px solid var(--border)", color: "var(--on-dark-soft)", background: "var(--card)" },
    danger:    { background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} rounded-lg font-medium flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-40`}
      style={styles[variant]}>
      {children}
    </button>
  )
}

function SaveBtn({ pending, saved }: { pending: boolean; saved: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "#2563eb" }}>
      {saved ? <><Check className="w-4 h-4" />Сохранено</> : pending ? "Сохранение..." : "Сохранить"}
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

function Alert({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div className="text-sm px-4 py-2 rounded-lg"
      style={{ background: type === "ok" ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)", color: type === "ok" ? "#16a34a" : "#dc2626" }}>
      {msg}
    </div>
  )
}

// ── Basic ────────────────────────────────────────────────────────

function BasicSection({ club }: { club: ClubData }) {
  const s = club.settings
  const [name, setName]         = useState(club.name)
  const [address, setAddress]   = useState(s.address ?? "")
  const [phone, setPhone]       = useState(s.phone ?? "")
  const [email, setEmail]       = useState(s.email ?? "")
  const [website, setWebsite]   = useState(s.website ?? "")
  const [tz, setTz]             = useState(s.timezone ?? "Asia/Tashkent")
  const [currency, setCurrency] = useState(s.currency ?? "UZS")
  const [workingHours, setWorkingHours] = useState(() => {
    const defaults = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((key) => [key, { open: "06:00", close: "23:00", closed: false }]))
    return { ...defaults, ...(s.working_hours ?? {}) }
  })
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pending, start]        = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaved(false); setError(null)
    start(async () => {
      const res = await saveClubBasicAction({ name, address, phone, email, website, timezone: tz, currency, workingHours })
      if (res.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Основная информация">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Название клуба"><Input value={name} onChange={setName} placeholder="FitClub" /></Field>
          <Field label="Адрес"><Input value={address} onChange={setAddress} placeholder="г. Ташкент, ул. Амира Темура 1" /></Field>
          <Field label="Телефон"><Input value={phone} onChange={setPhone} placeholder="+998 90 000 00 00" type="tel" /></Field>
          <Field label="Email"><Input value={email} onChange={setEmail} placeholder="info@fitclub.uz" type="email" /></Field>
          <Field label="Сайт"><Input value={website} onChange={setWebsite} placeholder="https://fitclub.uz" /></Field>
        </div>
      </Card>

      <Card title="Рабочие часы">
        <div className="space-y-2.5">
          {([["mon","Понедельник"],["tue","Вторник"],["wed","Среда"],["thu","Четверг"],["fri","Пятница"],["sat","Суббота"],["sun","Воскресенье"]] as const).map(([key, day]) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2">
              <span className="w-28 text-sm" style={{ color: "var(--on-dark-soft)" }}>{day}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={workingHours[key].closed} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], closed: event.target.checked } }))} />
                  Выходной
                </label>
                <input value={workingHours[key].open} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], open: event.target.value } }))} disabled={workingHours[key].closed} type="time" className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none disabled:opacity-40" />
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>—</span>
                <input value={workingHours[key].close} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], close: event.target.value } }))} disabled={workingHours[key].closed} type="time" className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none disabled:opacity-40" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Региональные настройки">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Часовой пояс">
            <select value={tz} onChange={(e) => setTz(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
              <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
              <option value="Asia/Almaty">Asia/Almaty (UTC+6)</option>
              <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
            </select>
          </Field>
          <Field label="Валюта">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
              <option value="UZS">UZS — Узбекский сум</option>
              <option value="USD">USD — Доллар США</option>
              <option value="RUB">RUB — Российский рубль</option>
            </select>
          </Field>
        </div>
      </Card>

      {error && <Alert msg={error} type="err" />}
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

// ── Branches ─────────────────────────────────────────────────────

type BranchItem = { clubId: string; name: string; role: string; plan: string }

function BranchesSection({ club }: { club: ClubData }) {
  const router = useRouter()
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [bName, setBName]       = useState("")
  const [bAddr, setBAddr]       = useState("")
  const [msg, setMsg]           = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [pending, start]        = useTransition()

  useEffect(() => {
    getBranchesAction().then((data) => { setBranches(data); setLoading(false) })
  }, [])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!bName.trim()) return
    start(async () => {
      const res = await createBranchAction({ name: bName.trim(), address: bAddr.trim() })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setBName(""); setBAddr(""); setShowForm(false)
      setMsg({ text: "Филиал создан", type: "ok" })
      setTimeout(() => setMsg(null), 2500)
      const updated = await getBranchesAction()
      setBranches(updated)
    })
  }

  async function handleSwitch(clubId: string) {
    setSwitching(clubId)
    await switchBranchAction(clubId)
    router.refresh()
    setSwitching(null)
  }

  return (
    <Card title="Филиалы" action={
      <Btn small onClick={() => setShowForm((v) => !v)}>
        <Plus className="w-3.5 h-3.5" /> Добавить
      </Btn>
    }>
      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 p-4 rounded-lg space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <Field label="Название филиала">
            <Input value={bName} onChange={setBName} placeholder="Зал №2" />
          </Field>
          <Field label="Город / адрес">
            <Input value={bAddr} onChange={setBAddr} placeholder="г. Ташкент" />
          </Field>
          <div className="flex gap-2">
            <Btn type="submit" disabled={pending || !bName.trim()}>
              {pending ? "Создание..." : "Создать"}
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Отмена</Btn>
          </div>
        </form>
      )}
      {msg && <div className="mb-4"><Alert msg={msg.text} type={msg.type} /></div>}

      {loading ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--on-dark-soft)" }}>Загрузка...</p>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => {
            const isActive = b.clubId === club.id
            return (
              <div key={b.clubId} className="flex items-center justify-between p-3 rounded-lg" style={{ background: isActive ? "var(--card-2)" : "transparent", border: `1px solid ${isActive ? "var(--border)" : "var(--border-subtle)"}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{ background: isActive ? "var(--pill-active)" : "var(--card-2)", color: isActive ? "white" : "var(--on-dark-soft)" }}>
                    {b.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{b.name}</span>
                      {isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                          Активный
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{b.role}</span>
                  </div>
                </div>
                {!isActive && (
                  <button
                    onClick={() => handleSwitch(b.clubId)}
                    disabled={switching === b.clubId}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
                  >
                    {switching === b.clubId ? "..." : <><ArrowRight className="w-3 h-3" />Переключиться</>}
                  </button>
                )}
              </div>
            )
          })}
          {branches.length === 0 && (
            <p className="text-sm py-2" style={{ color: "var(--on-dark-soft)" }}>Нет филиалов</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Staff ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", admin: "Администратор", trainer: "Тренер", accountant: "Бухгалтер",
}

const MANAGEABLE_ROLES = ["admin", "trainer", "accountant"]

function StaffRow({
  staff,
  canManage,
  onUpdated,
}: {
  staff: ClubData["staffList"][0]
  canManage: boolean
  onUpdated: (msg: string) => void
}) {
  const [editingRole, setEditingRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState(staff.role)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, start] = useTransition()

  const canEdit = canManage && staff.role !== "owner"
  const canDelete = canManage && staff.role !== "owner" && !staff.isMe

  function handleSaveRole() {
    start(async () => {
      const res = await updateStaffRoleAction(staff.id, selectedRole)
      if (res.error) { onUpdated(res.error); return }
      setEditingRole(false)
      onUpdated("")
    })
  }

  function handleRemove() {
    start(async () => {
      const res = await removeStaffAction(staff.id)
      if (res.error) { onUpdated(res.error); return }
      setConfirmDelete(false)
      onUpdated("")
    })
  }

  return (
    <div className="py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: "#3b82f6" }}>
          {(staff.name !== "—" ? staff.name : staff.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{staff.name}</p>
            {staff.isMe && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>Я</span>}
          </div>
          <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>{staff.email}</p>
        </div>

        {/* Role badge / editor */}
        {editingRole ? (
          <div className="flex items-center gap-1.5">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-8 px-2 rounded-lg text-xs outline-none appearance-none"
              style={{ border: "1.5px solid #2563eb", color: "var(--on-dark)", background: "var(--card)" }}
            >
              {MANAGEABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button onClick={handleSaveRole} disabled={pending}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setEditingRole(false); setSelectedRole(staff.role) }} disabled={pending}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
              {ROLE_LABELS[staff.role] ?? staff.role}
            </span>
            {canEdit && (
              <button onClick={() => { setEditingRole(true); setConfirmDelete(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{ color: "var(--on-dark-soft)" }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button onClick={() => { setConfirmDelete(true); setEditingRole(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{ color: "#dc2626" }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline delete confirm */}
      {confirmDelete && (
        <div className="mt-2 ml-12 flex items-center gap-2">
          <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Удалить сотрудника?</p>
          <button onClick={handleRemove} disabled={pending}
            className="h-6 px-2.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}>
            {pending ? "..." : "Удалить"}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="h-6 px-2.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
            Отмена
          </button>
        </div>
      )}
    </div>
  )
}

function StaffSection({ club }: { club: ClubData }) {
  const [showForm, setShowForm]   = useState(false)
  const [tab, setTab]             = useState<"email" | "link">("email")
  const [invEmail, setInvEmail]   = useState("")
  const [invRole, setInvRole]     = useState("trainer")
  const [msg, setMsg]             = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [copied, setCopied]       = useState(false)
  const [pending, start]          = useTransition()

  const canManage = ["owner", "admin"].includes(club.currentRole)

  function handleInvite(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    start(async () => {
      const res = await inviteStaffAction({ email: invEmail.trim(), role: invRole })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setMsg({ text: `Приглашение отправлено на ${invEmail.trim()}`, type: "ok" })
      setInvEmail(""); setShowForm(false)
      setTimeout(() => setMsg(null), 4000)
    })
  }

  function handleCopyLink() {
    setMsg(null)
    start(async () => {
      const res = await createInviteLinkAction({ role: invRole })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      await navigator.clipboard.writeText(res.url!)
      setCopied(true)
      setMsg({ text: "Ссылка скопирована! Отправьте её сотруднику в Telegram или WhatsApp", type: "ok" })
      setTimeout(() => { setCopied(false); setMsg(null); setShowForm(false) }, 4000)
    })
  }

  function handleStaffMsg(err: string) {
    if (err) setMsg({ text: err, type: "err" })
    else setMsg(null)
  }

  const roleSelect = (
    <Field label="Роль">
      <select value={invRole} onChange={(e) => setInvRole(e.target.value)}
        className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
        style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </Field>
  )

  return (
    <Card title="Сотрудники и роли" action={
      canManage ? (
        <Btn small onClick={() => { setShowForm((v) => !v); setMsg(null) }}>
          <Plus className="w-3.5 h-3.5" /> Пригласить
        </Btn>
      ) : undefined
    }>
      {showForm && (
        <div className="mb-5 p-4 rounded-xl space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: "var(--card-2)" }}>
            {([["email", "По Email"], ["link", "По ссылке"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className="h-8 rounded-md text-sm font-medium transition-all"
                style={tab === key
                  ? { background: "var(--card)", color: "var(--on-dark)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                  : { background: "transparent", color: "var(--on-dark-soft)" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "email" ? (
            <form onSubmit={handleInvite} className="space-y-3">
              <Field label="Email сотрудника">
                <Input value={invEmail} onChange={setInvEmail} placeholder="trainer@fitclub.uz" type="email" />
              </Field>
              {roleSelect}
              <div className="flex gap-2">
                <Btn type="submit" disabled={pending || !invEmail.trim()}>
                  {pending ? "Отправка..." : "Отправить приглашение"}
                </Btn>
                <Btn variant="secondary" onClick={() => setShowForm(false)}>Отмена</Btn>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {roleSelect}
              <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                Сгенерируется одноразовая ссылка — отправьте её сотруднику в Telegram или WhatsApp
              </p>
              <div className="flex gap-2">
                <Btn onClick={handleCopyLink} disabled={pending}>
                  {pending ? "Генерация..." : copied ? "Скопировано ✓" : "Скопировать ссылку"}
                </Btn>
                <Btn variant="secondary" onClick={() => setShowForm(false)}>Отмена</Btn>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <div className="mb-4"><Alert msg={msg.text} type={msg.type} /></div>}
      {club.staffList.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--gray-muted)" }}>Сотрудников нет</p>
      ) : (
        <div>
          {club.staffList.map((s) => (
            <StaffRow key={s.id} staff={s} canManage={canManage} onUpdated={handleStaffMsg} />
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Finance ───────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { key: "cash",  label: "Наличные" },
  { key: "card",  label: "Карта" },
  { key: "click", label: "Click" },
  { key: "payme", label: "Payme" },
  { key: "uzum",  label: "Uzum" },
]

function FinanceSection({ club }: { club: ClubData }) {
  const fin = club.settings.finance
  const [methods, setMethods]     = useState(new Set(fin?.methods ?? ["cash", "click", "payme", "uzum"]))
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pending, start]          = useTransition()

  function toggleMethod(key: string) {
    setMethods((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaved(false); setError(null)
    start(async () => {
      const res = await saveFinanceAction({ methods: [...methods] })
      if (res.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="space-y-4">
    <PaymentConnect club={club} />
    <form onSubmit={handleSave} className="space-y-4">
      <Card title="Методы оплаты">
        <div className="space-y-3">
          {PAYMENT_METHODS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              <Toggle checked={methods.has(key)} onChange={() => toggleMethod(key)} />
            </div>
          ))}
        </div>
      </Card>

      {error && <Alert msg={error} type="err" />}
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
    </div>
  )
}

// ── Приём онлайн-оплат (заявка на подключение Payme / Click) ──────
const PAY_PROVIDERS: { key: "payme" | "click"; name: string; letter: string; color: string; desc: string }[] = [
  { key: "payme", name: "Payme", letter: "P", color: "#33b1ff", desc: "Приём оплат картами через Payme" },
  { key: "click", name: "Click", letter: "C", color: "#00a3e0", desc: "Приём оплат картами через Click" },
]

function PaymentConnect({ club }: { club: ClubData }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const conn = club.paymentConnections ?? {}

  function request(p: "payme" | "click") {
    setBusyKey(p)
    start(() => runAction(() => requestPaymentConnectionAction(p), {
      success: "Заявка на подключение отправлена", onSuccess: () => router.refresh(), onError: () => setBusyKey(null),
    }).then(() => setBusyKey(null)))
  }
  function cancel(p: "payme" | "click") {
    setBusyKey(p)
    start(() => runAction(() => cancelPaymentConnectionAction(p), {
      success: "Заявка отменена", onSuccess: () => router.refresh(), onError: () => setBusyKey(null),
    }).then(() => setBusyKey(null)))
  }

  return (
    <Card title="Приём онлайн-оплат">
      <p className="text-xs mb-4" style={{ color: "var(--gray-muted)" }}>
        Оставьте заявку — менеджер платформы свяжется, запросит данные мерчанта и подключит приём оплат. Секретные ключи вводить здесь не нужно.
      </p>
      <div className="space-y-2.5">
        {PAY_PROVIDERS.map((pv) => {
          const status = conn[pv.key] // 'active' | 'new' | undefined
          const isBusy = pending && busyKey === pv.key
          return (
            <div key={pv.key} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-base font-bold text-white" style={{ background: pv.color }}>
                {pv.letter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{pv.name}</p>
                <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{pv.desc}</p>
              </div>
              {status === "active" ? (
                <span className="text-xs font-medium px-2.5 h-7 inline-flex items-center gap-1.5 rounded-lg" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                  <Check className="w-3.5 h-3.5" /> Подключено
                </span>
              ) : status === "new" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2.5 h-7 inline-flex items-center rounded-lg" style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
                    На рассмотрении
                  </span>
                  <button onClick={() => cancel(pv.key)} disabled={isBusy}
                    className="text-xs font-medium px-3 h-7 rounded-lg disabled:opacity-50" style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                    {isBusy ? "..." : "Отменить"}
                  </button>
                </div>
              ) : (
                <button onClick={() => request(pv.key)} disabled={isBusy}
                  className="text-xs font-medium px-3.5 h-8 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: "#2563eb" }}>
                  {isBusy ? "..." : "Подключить"}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Notifications ─────────────────────────────────────────────────

function NotificationsSection({ club }: { club: ClubData }) {
  const [settings, setSettings] = useState<TelegramSettings>({
    ...DEFAULT_TG_SETTINGS,
    ...(club.settings.tg_settings ?? {}),
  })
  const [saved, setSaved]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start]    = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    start(async () => {
      const result = await saveTelegramSettingsAction(settings)
      if (result.error) { setError(result.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  const options: { key: keyof TelegramSettings; label: string; description: string }[] = [
    { key: "auto_expiry_3d", label: "За 3 дня до окончания", description: "Telegram-напоминание клиенту" },
    { key: "auto_expiry_1d", label: "За 1 день до окончания", description: "Повторное Telegram-напоминание" },
    { key: "renewal_reminder", label: "Быстрое продление", description: "Добавить в напоминание кнопку абонемента" },
    { key: "class_reminders", label: "Занятия на сегодня", description: "Утром отправить клиенту его записи" },
  ]

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Card title="Telegram-уведомления">
        <div className="space-y-4">
          {options.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--card-2)" }}>
                  <MessageCircle className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Toggle checked={Boolean(settings[key])} onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">Шаблоны сообщений и подключение бота находятся в разделе «Интеграции».</p>
      {error && <Alert msg={error} type="err" />}
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

// ── Integrations ──────────────────────────────────────────────────

function IntegrationsSection() {
  const integrations = [
    { slug: "telegram", label: "Telegram Bot", description: "Бот, рассылки, Mini App и автонапоминания" },
    { slug: "payme", label: "Payme", description: "Заявка на подключение и статус онлайн-оплат" },
    { slug: "click", label: "Click", description: "Заявка на подключение и статус онлайн-оплат" },
    { slug: "instagram", label: "Instagram", description: "Публикации, метрики и атрибуция клиентов" },
  ]
  return (
    <Card title="Интеграции">
      <div className="space-y-3">
        {integrations.map((integration) => (
          <Link key={integration.slug} href={`/integrations/${integration.slug}`} className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-foreground">{integration.label[0]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{integration.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{integration.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Card>
  )
}

// ── Security ──────────────────────────────────────────────────────

function SecuritySection() {
  const [cur, setCur]       = useState("")
  const [next, setNext]     = useState("")
  const [conf, setConf]     = useState("")
  const [show, setShow]     = useState(false)
  const [msg, setMsg]       = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start]    = useTransition()
  const [sessionsMsg, setSessionsMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null)

  function handlePw(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (next.length < 8) { setMsg({ text: "Пароль должен быть не менее 8 символов", type: "err" }); return }
    if (next !== conf)   { setMsg({ text: "Пароли не совпадают", type: "err" }); return }
    start(async () => {
      const res = await changePasswordAction(cur, next)
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setMsg({ text: "Пароль успешно изменён", type: "ok" })
      setCur(""); setNext(""); setConf("")
      setTimeout(() => setMsg(null), 3000)
    })
  }

  function handleSignOutOthers() {
    setSessionsMsg(null)
    start(async () => {
      const result = await signOutOtherSessionsAction()
      setSessionsMsg(result.error
        ? { text: result.error, type: "err" }
        : { text: "Другие сессии завершены", type: "ok" })
    })
  }

  const type = show ? "text" : "password"

  return (
    <div className="space-y-4">
      <Card title="Пароль" action={
        <button type="button" onClick={() => setShow((v) => !v)}
          className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gray-muted)" }}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {show ? "Скрыть" : "Показать"}
        </button>
      }>
        <form onSubmit={handlePw} className="space-y-3 max-w-sm">
          <Field label="Текущий пароль">
            <Input value={cur} onChange={setCur} type={type} placeholder="••••••••" />
          </Field>
          <Field label="Новый пароль">
            <Input value={next} onChange={setNext} type={type} placeholder="••••••••" />
          </Field>
          <Field label="Повторите новый пароль">
            <Input value={conf} onChange={setConf} type={type} placeholder="••••••••" />
          </Field>
          {msg && <Alert msg={msg.text} type={msg.type} />}
          <Btn type="submit" disabled={pending || !cur || !next || !conf}>
            {pending ? "Сохранение..." : "Сменить пароль"}
          </Btn>
        </form>
      </Card>

      <Card title="Активные сессии">
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>Текущее устройство</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Останется в системе после завершения других сессий</p>
          </div>
          <Btn variant="secondary" onClick={handleSignOutOthers} disabled={pending}>
            <LogOut className="h-4 w-4" /> Выйти на других
          </Btn>
        </div>
        {sessionsMsg && <div className="mt-3"><Alert msg={sessionsMsg.text} type={sessionsMsg.type} /></div>}
      </Card>
    </div>
  )
}

// ── Plan ──────────────────────────────────────────────────────────

const MONTHS_OPTIONS = [{ m: 1, label: "1 мес" }, { m: 3, label: "3 мес" }, { m: 12, label: "12 мес" }]

function fmtPlanPrice(price: number, currency: string, isTrial: boolean): string {
  if (isTrial || price === 0) return "Бесплатно"
  return fmtMoney(price, currency)
}
const fmtLimit = (n: number | null) => (n == null ? "∞" : n.toLocaleString("ru-RU"))

function PlanSection({ club }: { club: ClubData }) {
  const plan   = club.plan
  const plans  = club.plans ?? []
  const current = plans.find((p) => p.code === plan)
  const paidPlans = plans.filter((p) => !p.isTrial && p.isActive)
  const daysLeft = club.planExpiresAt
    ? Math.ceil((new Date(club.planExpiresAt).getTime() - club.generatedAt) / 86_400_000)
    : club.trialExpiresAt
      ? Math.ceil((new Date(club.trialExpiresAt).getTime() - club.generatedAt) / 86_400_000)
      : null
  const router = useRouter()
  const [pending, start] = useTransition()
  const [months, setMonths] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const req = club.pendingRequest

  function requestPlan(p: string) {
    setErr(null)
    start(async () => {
      const res = await requestPlanAction(p, months)
      if (res.error) { setErr(res.error); return }
      router.refresh()
    })
  }
  function cancelRequest() {
    start(async () => { await cancelPlanRequestAction(); router.refresh() })
  }

  return (
    <div className="space-y-4">
      {/* Активная заявка */}
      {req && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)" }}>
          <Crown className="w-5 h-5 shrink-0" style={{ color: "#2563eb" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "#1e3a8a" }}>
              Заявка отправлена: {plans.find((x) => x.code === req.plan)?.name ?? PLAN_LABELS[req.plan] ?? req.plan} · {req.months} мес{req.amount != null ? ` · ${fmtMoney(req.amount, current?.currency ?? "UZS")}` : ""}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#3b82f6" }}>Ожидает подтверждения администратором. Мы свяжемся для оплаты.</p>
          </div>
          <button onClick={cancelRequest} disabled={pending}
            className="text-xs font-medium px-3 h-8 rounded-lg disabled:opacity-50" style={{ border: "1px solid var(--border)", color: "#2563eb", background: "var(--card)" }}>
            Отменить
          </button>
        </div>
      )}

      <Card title="Текущий тариф">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,6,0.14)" }}>
            <Crown className="w-6 h-6" style={{ color: "#d97706" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold" style={{ color: "var(--on-dark)" }}>{current?.name ?? PLAN_LABELS[plan] ?? plan}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(217,119,6,0.14)", color: "#d97706" }}>
                {fmtPlanPrice(club.planPriceLocked ?? current?.price ?? 0, current?.currency ?? "USD", plan === "trial" || !!current?.isTrial)} / мес
              </span>
            </div>
            {daysLeft !== null && (
              <p className="text-sm mt-0.5" style={{ color: daysLeft <= 7 ? "#dc2626" : "var(--on-dark-soft)" }}>
                {daysLeft > 0 ? `Осталось ${daysLeft} дн.` : "Срок истёк"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: "Клиенты",    used: club.clientCount,      max: current?.clients ?? null },
            { label: "Сотрудники", used: club.staffList.length,               max: current?.staff ?? null },
          ].map(({ label, used, max }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: "var(--on-dark)" }}>{used} / {fmtLimit(max)}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--card-2)" }}>
                <div className="h-2 rounded-full transition-all"
                  style={{ background: "#2563eb", width: `${max == null ? 4 : Math.min(100, (used / max) * 100)}%`, opacity: max == null ? 0.4 : 1 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Тарифы">
        {/* Период оплаты */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Период:</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--card-2)" }}>
            {MONTHS_OPTIONS.map((o) => (
              <button key={o.m} onClick={() => setMonths(o.m)}
                className="h-7 px-3 rounded-md text-xs font-medium transition-all"
                style={{ background: months === o.m ? "white" : "transparent", color: months === o.m ? "#2563eb" : "var(--on-dark-soft)", boxShadow: months === o.m ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-sm mb-3" style={{ color: "#dc2626" }}>{err}</p>}

        {paidPlans.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--gray-muted)" }}>Тарифы недоступны</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {paidPlans.map((pl) => {
            const isCurrent = pl.code === plan
            const requested = req?.plan === pl.code
            const highlight = pl.isPopular && !isCurrent   // акцентная (синяя) карточка, как «Популярный» на лендинге
            const total = pl.price * months
            const money = fmtMoney(total, pl.currency)
            const tMain = highlight ? "#ffffff" : "var(--on-dark)"
            const tMuted = highlight ? "rgba(255,255,255,0.75)" : "var(--on-dark-soft)"
            return (
              <div key={pl.code} className="relative rounded-2xl p-5 flex flex-col"
                style={{
                  border: `1.5px solid ${highlight ? "#2563eb" : isCurrent ? "#2563eb" : "var(--border)"}`,
                  background: highlight ? "#2563eb" : isCurrent ? "rgba(37,99,235,0.1)" : "var(--card)",
                }}>
                {highlight && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 h-5 inline-flex items-center gap-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                    <Crown className="w-3 h-3" />Популярный
                  </span>
                )}
                {/* icon + name */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                    style={highlight
                      ? { background: "rgba(255,255,255,0.15)", color: "#fff" }
                      : { background: `${pl.color}22`, color: pl.color }}>
                    {pl.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: tMain }}>{pl.name}</p>
                    {pl.subtitle && <p className="text-[11px] truncate" style={{ color: tMuted }}>{pl.subtitle}</p>}
                  </div>
                </div>
                {/* price */}
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold tracking-[-0.5px]" style={{ color: highlight ? "#fff" : "#2563eb" }}>{money}</span>
                  <span className="text-xs" style={{ color: tMuted }}>{months > 1 ? `/ ${months} мес` : "/мес"}</span>
                </div>
                {/* benefits */}
                <div className="h-px w-full mb-3" style={{ background: highlight ? "rgba(255,255,255,0.2)" : "var(--border-subtle)" }} />
                <ul className="flex flex-col gap-2 mb-4 flex-1">
                  {pl.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" style={{ color: highlight ? "#fff" : "#2563eb" }} />
                      <span className="text-[13px]" style={{ color: highlight ? "rgba(255,255,255,0.9)" : "var(--on-dark-soft)" }}>{b}</span>
                    </li>
                  ))}
                </ul>
                {/* CTA / status */}
                {isCurrent ? (
                  <div className="h-9 flex items-center justify-center gap-1.5 rounded-lg" style={{ background: "rgba(37,99,235,0.1)" }}>
                    <Check className="w-4 h-4" style={{ color: "#2563eb" }} />
                    <span className="text-xs font-semibold" style={{ color: "#2563eb" }}>Текущий тариф</span>
                  </div>
                ) : requested ? (
                  <div className="h-9 flex items-center justify-center gap-1.5 rounded-lg" style={{ background: highlight ? "rgba(255,255,255,0.15)" : "rgba(59,130,246,0.1)" }}>
                    <Check className="w-4 h-4" style={{ color: highlight ? "#fff" : "#3b82f6" }} />
                    <span className="text-xs font-semibold" style={{ color: highlight ? "#fff" : "#3b82f6" }}>Заявка отправлена</span>
                  </div>
                ) : (
                  <button onClick={() => requestPlan(pl.code)} disabled={pending}
                    className="w-full h-9 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={highlight ? { background: "rgba(37,99,235,0.12)", color: "#2563eb" } : { background: "#2563eb", color: "#fff" }}>
                    {pending ? "..." : (plan === "trial" ? "Оформить" : "Перейти")}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        )}
        <p className="text-xs mt-4" style={{ color: "var(--gray-muted)" }}>
          После заявки менеджер свяжется для оплаты (Payme / Click / перевод). Тариф активирует администратор платформы.
        </p>
      </Card>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export function ClubSettings({ club, section }: { club: ClubData; section: Section }) {
  switch (section) {
    case "basic":         return <BasicSection club={club} />
    case "branches":      return <BranchesSection club={club} />
    case "staff":         return <StaffSection club={club} />
    case "finance":       return <FinanceSection club={club} />
    case "notifications": return <NotificationsSection club={club} />
    case "integrations":  return <IntegrationsSection />
    case "security":      return <SecuritySection />
    case "plan":          return <PlanSection club={club} />
  }
}
