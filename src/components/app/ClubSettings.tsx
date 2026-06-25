"use client"

import { useState, useTransition, useRef } from "react"
import {
  Building2, GitBranch, Users, Wallet, Bell,
  Plug, Shield, Crown, Check, X, Plus,
  Smartphone, Mail, MessageCircle, Eye, EyeOff,
} from "lucide-react"
import {
  saveClubBasicAction,
  saveNotificationsAction,
  saveFinanceAction,
  changePasswordAction,
  saveBranchAction,
  inviteStaffAction,
  saveIntegrationAction,
} from "@/app/(app)/settings/club/actions"

export type ClubData = {
  id: string
  name: string
  plan: string
  trialExpiresAt: string | null
  planExpiresAt: string | null
  settings: {
    address?: string
    phone?: string
    email?: string
    website?: string
    timezone?: string
    currency?: string
    notifications?: Record<string, boolean>
    branches?: { name: string; address: string }[]
    finance?: { methods: string[]; autoNum: boolean; categories: string[] }
  }
  staffList: { id: string; name: string; role: string; email: string }[]
}

type Section = "basic" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "security" | "plan"

const SECTIONS: { key: Section; label: string; icon: typeof Building2 }[] = [
  { key: "basic",          label: "Основное",          icon: Building2 },
  { key: "branches",       label: "Филиалы",           icon: GitBranch },
  { key: "staff",          label: "Сотрудники",        icon: Users },
  { key: "finance",        label: "Финансы",           icon: Wallet },
  { key: "notifications",  label: "Уведомления",       icon: Bell },
  { key: "integrations",   label: "Интеграции",        icon: Plug },
  { key: "security",       label: "Безопасность",      icon: Shield },
  { key: "plan",           label: "Подписка",          icon: Crown },
]

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
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
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
    danger:    { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
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
      style={{ background: type === "ok" ? "#f0fdf4" : "#fef2f2", color: type === "ok" ? "#16a34a" : "#dc2626" }}>
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
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pending, start]        = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaved(false); setError(null)
    start(async () => {
      const res = await saveClubBasicAction({ name, address, phone, email, website, timezone: tz, currency })
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
          {["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"].map((day) => (
            <div key={day} className="flex items-center justify-between">
              <span className="text-sm w-28" style={{ color: "var(--on-dark-soft)" }}>{day}</span>
              <div className="flex items-center gap-2">
                <input defaultValue="06:00" type="time" className="h-8 px-2 rounded-md text-sm outline-none" style={{ border: "1px solid var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--gray-muted)" }}>—</span>
                <input defaultValue="23:00" type="time" className="h-8 px-2 rounded-md text-sm outline-none" style={{ border: "1px solid var(--border)" }} />
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

function BranchesSection({ club }: { club: ClubData }) {
  const initial = club.settings.branches ?? [{ name: "Основной зал", address: club.settings.address ?? "—" }]
  const [branches, setBranches] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [bName, setBName]       = useState("")
  const [bAddr, setBAddr]       = useState("")
  const [msg, setMsg]           = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start]        = useTransition()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!bName.trim()) return
    start(async () => {
      const res = await saveBranchAction({ name: bName.trim(), address: bAddr.trim() })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setBranches((prev) => [...prev, { name: bName.trim(), address: bAddr.trim() }])
      setBName(""); setBAddr(""); setShowForm(false)
      setMsg({ text: "Филиал добавлен", type: "ok" })
      setTimeout(() => setMsg(null), 2500)
    })
  }

  return (
    <Card title="Филиалы" action={
      <Btn small onClick={() => setShowForm((v) => !v)}>
        <Plus className="w-3.5 h-3.5" /> Добавить
      </Btn>
    }>
      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 p-4 rounded-xl space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <Field label="Название филиала">
            <Input value={bName} onChange={setBName} placeholder="Зал №2" />
          </Field>
          <Field label="Адрес">
            <Input value={bAddr} onChange={setBAddr} placeholder="г. Ташкент, ул. ..." />
          </Field>
          <div className="flex gap-2">
            <Btn type="submit" disabled={pending || !bName.trim()}>
              {pending ? "Сохранение..." : "Добавить"}
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Отмена</Btn>
          </div>
        </form>
      )}
      {msg && <div className="mb-4"><Alert msg={msg.text} type={msg.type} /></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Название","Адрес"].map((h) => (
                <th key={h} className="py-2 pr-4 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branches.map((b, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td className="py-3 pr-4 font-medium" style={{ color: "var(--on-dark)" }}>{b.name}</td>
                <td className="py-3" style={{ color: "var(--on-dark-soft)" }}>{b.address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Staff ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", admin: "Администратор", trainer: "Тренер", accountant: "Бухгалтер",
}

function StaffSection({ club }: { club: ClubData }) {
  const [showForm, setShowForm] = useState(false)
  const [invEmail, setInvEmail] = useState("")
  const [invRole, setInvRole]   = useState("trainer")
  const [msg, setMsg]           = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start]        = useTransition()

  function handleInvite(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    start(async () => {
      const res = await inviteStaffAction({ email: invEmail.trim(), role: invRole })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setMsg({ text: `Приглашение отправлено на ${invEmail.trim()}`, type: "ok" })
      setInvEmail(""); setShowForm(false)
      setTimeout(() => setMsg(null), 3000)
    })
  }

  return (
    <Card title="Сотрудники и роли" action={
      <Btn small onClick={() => setShowForm((v) => !v)}>
        <Plus className="w-3.5 h-3.5" /> Пригласить
      </Btn>
    }>
      {showForm && (
        <form onSubmit={handleInvite} className="mb-5 p-4 rounded-xl space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <Field label="Email сотрудника">
            <Input value={invEmail} onChange={setInvEmail} placeholder="trainer@fitclub.uz" type="email" />
          </Field>
          <Field label="Роль">
            <select value={invRole} onChange={(e) => setInvRole(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none appearance-none"
              style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <Btn type="submit" disabled={pending || !invEmail.trim()}>
              {pending ? "Отправка..." : "Отправить приглашение"}
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Отмена</Btn>
          </div>
        </form>
      )}
      {msg && <div className="mb-4"><Alert msg={msg.text} type={msg.type} /></div>}
      {club.staffList.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--gray-muted)" }}>Сотрудников нет</p>
      ) : (
        <div>
          {club.staffList.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: "#3b82f6" }}>
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{s.name}</p>
                <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{s.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                {ROLE_LABELS[s.role] ?? s.role}
              </span>
            </div>
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
  const [autoNum, setAutoNum]     = useState(fin?.autoNum ?? true)
  const [cats, setCats]           = useState<string[]>(fin?.categories ?? ["Аренда","Зарплаты","Реклама","Коммунальные"])
  const [newCat, setNewCat]       = useState("")
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pending, start]          = useTransition()

  function toggleMethod(key: string) {
    setMethods((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  function addCat() {
    const v = newCat.trim()
    if (!v || cats.includes(v)) return
    setCats((prev) => [...prev, v]); setNewCat("")
  }

  function removeCat(cat: string) { setCats((prev) => prev.filter((c) => c !== cat)) }

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaved(false); setError(null)
    start(async () => {
      const res = await saveFinanceAction({ methods: [...methods], autoNum, categories: cats })
      if (res.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
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

      <Card title="Настройки кассы">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>Автоматическая нумерация платежей</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Платежи будут нумероваться автоматически: #001, #002…</p>
          </div>
          <Toggle checked={autoNum} onChange={setAutoNum} />
        </div>
      </Card>

      <Card title="Категории расходов">
        <div className="space-y-1 mb-3">
          {cats.map((cat) => (
            <div key={cat} className="flex items-center justify-between py-2 px-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{cat}</span>
              <button type="button" onClick={() => removeCat(cat)}
                className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-red-50"
                style={{ color: "var(--gray-muted)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCat() } }}
            placeholder="Новая категория..." className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
            style={{ border: "1px dashed #e2e8f0", color: "var(--on-dark)" }} />
          <Btn small onClick={addCat} disabled={!newCat.trim()}>
            <Plus className="w-3.5 h-3.5" /> Добавить
          </Btn>
        </div>
      </Card>

      {error && <Alert msg={error} type="err" />}
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

// ── Notifications ─────────────────────────────────────────────────

const NOTIF_SETTINGS = [
  { key: "sms_3d",        label: "SMS за 3 дня до окончания",        icon: Smartphone },
  { key: "sms_7d",        label: "SMS за 7 дней до окончания",       icon: Smartphone },
  { key: "tg_owner",      label: "Telegram-уведомления владельцу",   icon: MessageCircle },
  { key: "email_reports", label: "Email-отчёты",                     icon: Mail },
]

function NotificationsSection({ club }: { club: ClubData }) {
  const def = club.settings.notifications ?? {}
  const [settings, setSettings] = useState<Record<string, boolean>>({
    sms_3d:        def.sms_3d        ?? true,
    sms_7d:        def.sms_7d        ?? false,
    tg_owner:      def.tg_owner      ?? true,
    email_reports: def.email_reports ?? false,
  })
  const [saved, setSaved]   = useState(false)
  const [pending, start]    = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      await saveNotificationsAction(settings)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Card title="Настройки уведомлений">
        <div className="space-y-4">
          {NOTIF_SETTINGS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--card-2)" }}>
                  <Icon className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
                </div>
                <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
              </div>
              <Toggle checked={settings[key]} onChange={(v) => setSettings((s) => ({ ...s, [key]: v }))} />
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end"><SaveBtn pending={pending} saved={saved} /></div>
    </form>
  )
}

// ── Integrations ──────────────────────────────────────────────────

type IntegrationField = { key: string; label: string; placeholder: string }

const INTEGRATIONS: { key: string; label: string; desc: string; color: string; fields: IntegrationField[] }[] = [
  {
    key: "telegram", label: "Telegram Bot", desc: "OTP-коды и уведомления клиентам", color: "#2563eb",
    fields: [{ key: "token", label: "Bot Token", placeholder: "1234567890:AAF..." }],
  },
  {
    key: "click", label: "Click", desc: "Приём онлайн-платежей через Click", color: "#16a34a",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "12345" },
      { key: "secret_key",  label: "Secret Key",  placeholder: "••••••••" },
    ],
  },
  {
    key: "payme", label: "Payme", desc: "Приём онлайн-платежей через Payme", color: "#7c3aed",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "merchant_id" },
      { key: "key",         label: "Key",          placeholder: "••••••••" },
    ],
  },
]

function IntegrationCard({ integration }: { integration: typeof INTEGRATIONS[0] }) {
  const [open, setOpen]       = useState(false)
  const [vals, setVals]       = useState<Record<string, string>>({})
  const [msg, setMsg]         = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start]      = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    const primary = integration.fields[0]
    const value = vals[primary.key] ?? ""
    if (!value.trim()) return
    start(async () => {
      const res = await saveIntegrationAction(integration.key, value.trim())
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setMsg({ text: "Сохранено!", type: "ok" })
      setOpen(false); setTimeout(() => setMsg(null), 2500)
    })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: integration.color }}>
          {integration.label[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{integration.label}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{integration.desc}</p>
        </div>
        <Btn small variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Отмена" : "Подключить"}
        </Btn>
      </div>
      {open && (
        <form onSubmit={handleSave} className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="pt-4 space-y-3">
            {integration.fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input value={vals[f.key] ?? ""} onChange={(v) => setVals((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder} type={f.key.includes("key") || f.key === "token" ? "password" : "text"} />
              </Field>
            ))}
          </div>
          {msg && <Alert msg={msg.text} type={msg.type} />}
          <Btn type="submit" disabled={pending || !vals[integration.fields[0].key]?.trim()}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Btn>
        </form>
      )}
      {msg && !open && <div className="px-4 pb-4"><Alert msg={msg.text} type={msg.type} /></div>}
    </div>
  )
}

function IntegrationsSection() {
  return (
    <Card title="Интеграции">
      <div className="space-y-3">
        {INTEGRATIONS.map((intg) => <IntegrationCard key={intg.key} integration={intg} />)}
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
  const [twofa, setTwofa]   = useState(false)

  function handlePw(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (next.length < 6) { setMsg({ text: "Пароль должен быть не менее 6 символов", type: "err" }); return }
    if (next !== conf)   { setMsg({ text: "Пароли не совпадают", type: "err" }); return }
    start(async () => {
      const res = await changePasswordAction(next)
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setMsg({ text: "Пароль успешно изменён", type: "ok" })
      setCur(""); setNext(""); setConf("")
      setTimeout(() => setMsg(null), 3000)
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
          <Btn type="submit" disabled={pending || !next || !conf}>
            {pending ? "Сохранение..." : "Сменить пароль"}
          </Btn>
        </form>
      </Card>

      <Card title="Активные сессии">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>Текущее устройство</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Сейчас онлайн</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#dcfce7", color: "#16a34a" }}>Активна</span>
        </div>
      </Card>

      <Card title="Двухфакторная авторизация">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>2FA через Telegram</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Дополнительная защита входа</p>
          </div>
          <Toggle checked={twofa} onChange={setTwofa} />
        </div>
        {twofa && (
          <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: "#eff6ff", color: "#2563eb" }}>
            Для активации 2FA сначала подключите Telegram Bot в разделе Интеграции.
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Plan ──────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { clients: number; staff: number; price: string }> = {
  trial:    { clients: 50,   staff: 2,  price: "0$"  },
  starter:  { clients: 500,  staff: 5,  price: "19$" },
  standard: { clients: 1500, staff: 10, price: "35$" },
  business: { clients: 3000, staff: 15, price: "49$" },
}

function PlanSection({ club }: { club: ClubData }) {
  const plan   = club.plan
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial
  const daysLeft = club.planExpiresAt
    ? Math.ceil((new Date(club.planExpiresAt).getTime() - Date.now()) / 86_400_000)
    : club.trialExpiresAt
      ? Math.ceil((new Date(club.trialExpiresAt).getTime() - Date.now()) / 86_400_000)
      : null
  const [upgrading, setUpgrading] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card title="Текущий тариф">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#fef3c7" }}>
            <Crown className="w-6 h-6" style={{ color: "#d97706" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold" style={{ color: "var(--on-dark)" }}>{PLAN_LABELS[plan] ?? plan}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#fef3c7", color: "#d97706" }}>
                {limits.price} / мес
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
            { label: "Клиенты",    used: club.staffList.length > 0 ? 18 : 0, max: limits.clients },
            { label: "Сотрудники", used: club.staffList.length,               max: limits.staff },
          ].map(({ label, used, max }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: "var(--on-dark)" }}>{used} / {max}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--card-2)" }}>
                <div className="h-2 rounded-full transition-all"
                  style={{ background: "#2563eb", width: `${Math.min(100, (used / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Тарифы">
        <div className="grid grid-cols-2 gap-3">
          {(["starter","standard","business"] as const).map((p) => {
            const l = PLAN_LIMITS[p]
            const isCurrent = p === plan
            return (
              <div key={p} className="p-4 rounded-xl" style={{ border: `1.5px solid ${isCurrent ? "#2563eb" : "var(--border)"}`, background: isCurrent ? "#eff6ff" : "var(--card)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{PLAN_LABELS[p]}</p>
                <p className="text-xl font-bold mt-1" style={{ color: "#2563eb" }}>
                  {l.price}<span className="text-xs font-normal" style={{ color: "var(--gray-muted)" }}>/мес</span>
                </p>
                <p className="text-xs mt-2" style={{ color: "var(--on-dark-soft)" }}>до {l.clients} клиентов</p>
                <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>до {l.staff} сотрудников</p>
                {isCurrent ? (
                  <div className="mt-3 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />
                    <span className="text-xs font-medium" style={{ color: "#2563eb" }}>Текущий</span>
                  </div>
                ) : (
                  upgrading === p ? (
                    <div className="mt-3 p-2 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--on-dark-soft)" }}>
                      Свяжитесь с нами: <br /><span className="font-medium" style={{ color: "#2563eb" }}>support@fitcrm.uz</span>
                    </div>
                  ) : (
                    <button onClick={() => setUpgrading(p)}
                      className="mt-3 w-full h-8 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
                      style={{ background: "#2563eb" }}>
                      Выбрать
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
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
