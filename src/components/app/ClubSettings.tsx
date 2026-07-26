"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Crown, Check, X, Plus, ArrowRight,
  MessageCircle, Eye, EyeOff, LogOut,
  Pencil, Trash2, Users, Building2, Package, ShieldCheck,
  Plug, Bot, Send, Upload, Download, CalendarDays, Clock3,
} from "lucide-react"
import {
  Card as UiCard,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button as UiButton } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { showActionError } from "@/lib/plan-limit-client"
import { useAppLocale } from "@/components/app/ClubContext"
import {
  APP_LOCALE_LABELS,
  normalizeAppLocale,
  translate,
  type AppLocale,
} from "@/lib/app-locale"

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
    communication_language?: AppLocale
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
  planUsage?: PlanUsageForClient[]
}

export type PlanUsageForClient = {
  key: "clients" | "staff" | "branches" | "products" | "roles" | "integrations" | "ai_requests" | "telegram_messages" | "imports" | "exports"
  used: number
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
  limits: Record<string, number | null>
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
  const { t } = useAppLocale()
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "#2563eb" }}>
      {saved
        ? <><Check className="w-4 h-4" />{t("settings.saved")}</>
        : pending
          ? t("settings.saving")
          : t("settings.save")}
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
  const router = useRouter()
  const { locale, t } = useAppLocale()
  const s = club.settings
  const [name, setName]         = useState(club.name)
  const [address, setAddress]   = useState(s.address ?? "")
  const [phone, setPhone]       = useState(s.phone ?? "")
  const [email, setEmail]       = useState(s.email ?? "")
  const [website, setWebsite]   = useState(s.website ?? "")
  const [tz, setTz]             = useState(s.timezone ?? "Asia/Tashkent")
  const [currency, setCurrency] = useState(s.currency ?? "UZS")
  const [communicationLanguage, setCommunicationLanguage] = useState<AppLocale>(
    normalizeAppLocale(s.communication_language ?? locale),
  )
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
      const res = await saveClubBasicAction({
        name,
        address,
        phone,
        email,
        website,
        timezone: tz,
        currency,
        communicationLanguage,
        workingHours,
      })
      if (res.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      router.refresh()
    })
  }

  const days = [
    ["mon", "days.mon"],
    ["tue", "days.tue"],
    ["wed", "days.wed"],
    ["thu", "days.thu"],
    ["fri", "days.fri"],
    ["sat", "days.sat"],
    ["sun", "days.sun"],
  ] as const
  const openHours = days
    .filter(([key]) => !workingHours[key].closed)
    .map(([key, label]) => `${translate(communicationLanguage, label)} ${workingHours[key].open}–${workingHours[key].close}`)
    .join("\n")

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title={t("settings.mainInfo")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("settings.clubName")}><Input value={name} onChange={setName} placeholder="FitClub" /></Field>
          <Field label={t("settings.address")}><Input value={address} onChange={setAddress} placeholder="г. Ташкент, ул. Амира Темура 1" /></Field>
          <Field label={t("settings.phone")}><Input value={phone} onChange={setPhone} placeholder="+998 90 000 00 00" type="tel" /></Field>
          <Field label={t("settings.email")}><Input value={email} onChange={setEmail} placeholder="info@fitclub.uz" type="email" /></Field>
          <Field label={t("settings.website")}><Input value={website} onChange={setWebsite} placeholder="https://fitclub.uz" /></Field>
        </div>
      </Card>

      <Card title={t("settings.hours")}>
        <div className="space-y-2.5">
          {days.map(([key, day]) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2">
              <span className="w-28 text-sm" style={{ color: "var(--on-dark-soft)" }}>{t(day)}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={workingHours[key].closed} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], closed: event.target.checked } }))} />
                  {t("settings.closed")}
                </label>
                <input value={workingHours[key].open} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], open: event.target.value } }))} disabled={workingHours[key].closed} type="time" className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none disabled:opacity-40" />
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>—</span>
                <input value={workingHours[key].close} onChange={(event) => setWorkingHours((value) => ({ ...value, [key]: { ...value[key], close: event.target.value } }))} disabled={workingHours[key].closed} type="time" className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none disabled:opacity-40" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("settings.regional")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label={t("settings.timezone")}>
            <select value={tz} onChange={(e) => setTz(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
              <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
              <option value="Asia/Almaty">Asia/Almaty (UTC+6)</option>
              <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
            </select>
          </Field>
          <Field label={t("settings.currency")}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
              <option value="UZS">UZS — Узбекский сум</option>
              <option value="USD">USD — Доллар США</option>
              <option value="RUB">RUB — Российский рубль</option>
            </select>
          </Field>
          <Field label={t("settings.botLanguage")}>
            <select
              value={communicationLanguage}
              onChange={(event) => setCommunicationLanguage(normalizeAppLocale(event.target.value))}
              className="h-10 w-full appearance-none rounded-lg px-3 text-sm outline-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}
            >
              {Object.entries(APP_LOCALE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("settings.botLanguageHint")}</p>
          </Field>
        </div>
      </Card>

      <Card title={t("settings.telegramPreview")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div>
            <p className="text-sm text-muted-foreground">{t("settings.telegramPreviewHint")}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">{t("settings.address")}:</span> {address || t("settings.notSpecified")}</p>
              <p><span className="text-muted-foreground">{t("settings.phone")}:</span> {phone || t("settings.notSpecified")}</p>
              <p><span className="text-muted-foreground">{t("settings.website")}:</span> {website || t("settings.notSpecified")}</p>
              <p><span className="text-muted-foreground">{t("settings.botLanguage")}:</span> {APP_LOCALE_LABELS[communicationLanguage]}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Bot className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{name || "FitCRM"}</p>
                <p className="text-xs text-muted-foreground">Telegram bot</p>
              </div>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">
              {`${name || "FitCRM"}\n${address || ""}${phone ? `\n${phone}` : ""}${website ? `\n${website}` : ""}${openHours ? `\n\n${translate(communicationLanguage, "settings.hoursSummary")}:\n${openHours}` : ""}`}
            </p>
          </div>
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
      if (res.error) { setMsg({ text: res.error, type: "err" }); showActionError(res.error); return }
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
      if (res.error) { setMsg({ text: res.error, type: "err" }); showActionError(res.error); return }
      setMsg({ text: `Приглашение отправлено на ${invEmail.trim()}`, type: "ok" })
      setInvEmail(""); setShowForm(false)
      setTimeout(() => setMsg(null), 4000)
    })
  }

  function handleCopyLink() {
    setMsg(null)
    start(async () => {
      const res = await createInviteLinkAction({ role: invRole })
      if (res.error) { setMsg({ text: res.error, type: "err" }); showActionError(res.error); return }
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

const PLAN_LIMIT_META = [
  { key: "clients", label: "Клиенты", icon: Users, monthly: false },
  { key: "staff", label: "Сотрудники", icon: Users, monthly: false },
  { key: "branches", label: "Филиалы", icon: Building2, monthly: false },
  { key: "products", label: "Товары", icon: Package, monthly: false },
  { key: "roles", label: "Пользовательские роли", icon: ShieldCheck, monthly: false },
  { key: "integrations", label: "Интеграции", icon: Plug, monthly: false },
  { key: "ai_requests", label: "AI-запросы", icon: Bot, monthly: true },
  { key: "telegram_messages", label: "Telegram-сообщения", icon: Send, monthly: true },
  { key: "imports", label: "Импорты", icon: Upload, monthly: true },
  { key: "exports", label: "Экспорты", icon: Download, monthly: true },
] as const

const PRIMARY_PLAN_LIMIT_KEYS = new Set(["clients", "staff", "branches", "ai_requests"])

function formatPlanDate(value: string | null) {
  if (!value) return "Без даты окончания"
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

function PlanSection({ club }: { club: ClubData }) {
  const plan   = club.plan
  const plans  = club.plans ?? []
  const current = plans.find((p) => p.code === plan)
  const paidPlans = plans.filter((p) => !p.isTrial && p.isActive)
  const expiresAt = club.planExpiresAt ?? club.trialExpiresAt
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

  const usageByKey = new Map((club.planUsage ?? []).map((item) => [item.key, item.used]))
  const currentPrice = club.planPriceLocked ?? current?.price ?? 0
  const currentCurrency = current?.currency ?? "UZS"
  const primaryLimits = PLAN_LIMIT_META.filter(({ key }) => PRIMARY_PLAN_LIMIT_KEYS.has(key))
  const secondaryLimits = PLAN_LIMIT_META.filter(({ key }) => !PRIMARY_PLAN_LIMIT_KEYS.has(key))

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Подписка</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Текущий тариф, доступный остаток лимитов и варианты перехода.
        </p>
      </div>

      {req && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-center">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Clock3 className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Заявка отправлена: {plans.find((x) => x.code === req.plan)?.name ?? PLAN_LABELS[req.plan] ?? req.plan} · {req.months} мес{req.amount != null ? ` · ${fmtMoney(req.amount, current?.currency ?? "UZS")}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Ожидает подтверждения. Менеджер свяжется для оплаты.</p>
          </div>
          <UiButton variant="outline" onClick={cancelRequest} disabled={pending}>
            Отменить
          </UiButton>
        </div>
      )}

      <UiCard className="gap-0 overflow-hidden py-0">
        <CardHeader className="grid-cols-1 border-b py-4 sm:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{current?.name ?? PLAN_LABELS[plan] ?? plan}</CardTitle>
                <Badge variant="secondary">Текущий тариф</Badge>
              </div>
              <CardDescription className="mt-1">
                {daysLeft !== null
                  ? daysLeft > 0
                    ? `Действует до ${formatPlanDate(expiresAt)}`
                    : "Срок действия тарифа истёк"
                  : "Тариф без даты окончания"}
              </CardDescription>
            </div>
          </div>
          <CardAction className="col-start-1 row-span-1 row-start-2 mt-2 justify-self-start text-left sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end sm:text-right">
            <p className="text-lg font-semibold text-foreground">
              {fmtPlanPrice(currentPrice, currentCurrency, plan === "trial" || !!current?.isTrial)}
            </p>
            <p className="text-xs text-muted-foreground">за месяц</p>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-px bg-border p-0 sm:grid-cols-[0.8fr_repeat(4,1fr)]">
          <div className="col-span-2 flex min-h-16 items-center gap-3 bg-card px-4 py-3 sm:col-span-1 sm:min-h-20">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Осталось</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {daysLeft === null ? "Без срока" : `${Math.max(0, daysLeft)} дн.`}
              </p>
            </div>
          </div>
          {primaryLimits.map(({ key, label, icon: Icon, monthly }) => {
            const used = usageByKey.get(key)
              ?? (key === "clients" ? club.clientCount : key === "staff" ? club.staffList.length : 0)
            const limit = current?.limits[key] ?? null
            const percent = limit === null ? 0 : limit <= 0 ? 100 : Math.min(100, (used / limit) * 100)
            return (
              <div key={key} className="min-h-20 bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span className="text-xs">{label}</span>
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {used.toLocaleString("ru-RU")}
                  <span className="font-normal text-muted-foreground"> / {fmtLimit(limit)}</span>
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: limit === null ? "3%" : `${percent}%`, opacity: limit === null ? 0.35 : 1 }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {monthly ? "за месяц" : "всего в клубе"}
                </p>
              </div>
            )
          })}
        </CardContent>
      </UiCard>

      <UiCard id="available-plans" className="gap-0 py-0">
        <CardHeader className="grid-cols-1 border-b py-4 sm:grid-cols-[1fr_auto]">
          <CardTitle>Доступные тарифы</CardTitle>
          <CardDescription className="col-start-1 row-start-2">Сравните возможности и выберите подходящий объём.</CardDescription>
          <CardAction className="col-span-2 col-start-1 row-start-3 mt-3 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
            <Tabs value={String(months)} onValueChange={(value) => setMonths(Number(value))}>
              <TabsList>
                {MONTHS_OPTIONS.map((option) => (
                  <TabsTab key={option.m} value={String(option.m)}>{option.label}</TabsTab>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>

        <CardContent className="py-4">
          {err && <p className="mb-4 text-sm text-destructive">{err}</p>}

          {paidPlans.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Тарифы временно недоступны</p>
          ) : (
            <div className="grid items-stretch gap-3 lg:grid-cols-3">
              {paidPlans.map((pl) => {
                const isCurrent = pl.code === plan
                const requested = req?.plan === pl.code
                const total = pl.price * months
                return (
                  <div
                    key={pl.code}
                    className={`flex flex-col rounded-xl border p-4 ${
                      isCurrent ? "border-brand bg-brand/[0.03] ring-1 ring-brand/20" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-lg text-sm font-semibold ${
                          isCurrent ? "bg-brand/10 text-brand" : "bg-muted text-foreground"
                        }`}>
                          {pl.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-foreground">{pl.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{pl.subtitle || "Тариф FitCRM"}</p>
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge variant="outline" className="border-brand/30 text-brand">Текущий</Badge>
                      ) : pl.isPopular ? (
                        <Badge variant="secondary">Популярный</Badge>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <p className="text-2xl font-semibold tracking-tight text-foreground">
                        {fmtPlanPrice(total, pl.currency, false)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {months === 1 ? "за месяц" : `за ${months} месяца · ${fmtMoney(pl.price, pl.currency)} / мес`}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/60 p-3">
                        <p className="text-[11px] text-muted-foreground">Клиенты</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{fmtLimit(pl.limits.clients ?? null)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-3">
                        <p className="text-[11px] text-muted-foreground">Сотрудники</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{fmtLimit(pl.limits.staff ?? null)}</p>
                      </div>
                    </div>

                    <ul className="mt-4 flex flex-1 flex-col gap-2 border-t pt-4">
                      {pl.benefits.slice(0, 4).map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4">
                      {isCurrent ? (
                        <UiButton className="w-full" variant="secondary" disabled>
                          <Check className="size-4" /> Текущий тариф
                        </UiButton>
                      ) : requested ? (
                        <UiButton className="w-full" variant="secondary" disabled>
                          <Clock3 className="size-4" /> Заявка отправлена
                        </UiButton>
                      ) : (
                        <UiButton className="w-full" onClick={() => requestPlan(pl.code)} disabled={pending}>
                          {pending ? "Отправляем..." : plan === "trial" ? "Оформить тариф" : "Перейти на тариф"}
                          {!pending && <ArrowRight className="size-4" />}
                        </UiButton>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            После заявки менеджер свяжется для оплаты через Payme, Click или банковский перевод.
          </p>
        </CardContent>
      </UiCard>

      <UiCard className="gap-0 overflow-hidden py-0">
        <Accordion>
          <AccordionItem value="limits" className="border-0">
            <AccordionTrigger className="rounded-none px-4 py-4 hover:no-underline">
              <span className="flex min-w-0 items-center gap-3 pr-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Все лимиты тарифа</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Товары, роли, интеграции и месячные операции
                  </span>
                </span>
              </span>
              <Badge variant="outline" className="mr-3 hidden shrink-0 sm:inline-flex">
                Ещё {secondaryLimits.length}
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="border-t px-4 pb-4 pt-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {secondaryLimits.map(({ key, label, icon: Icon, monthly }) => {
                  const used = usageByKey.get(key) ?? 0
                  const limit = current?.limits[key] ?? null
                  const remaining = limit === null ? null : Math.max(0, limit - used)
                  const percent = limit === null ? 0 : limit <= 0 ? 100 : Math.min(100, (used / limit) * 100)
                  const unavailable = limit === 0
                  return (
                    <div key={key} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <p className="truncate text-xs font-medium text-foreground">{label}</p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {used.toLocaleString("ru-RU")} / {fmtLimit(limit)}
                        </p>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand transition-[width]"
                          style={{ width: limit === null ? "3%" : `${percent}%`, opacity: limit === null ? 0.35 : 1 }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {unavailable
                          ? "Не входит в тариф"
                          : remaining === null
                            ? "Без ограничений"
                            : `Осталось ${remaining.toLocaleString("ru-RU")}${monthly ? " в этом месяце" : ""}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </UiCard>
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
