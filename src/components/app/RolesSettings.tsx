"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Check, ShieldCheck, Users, ChevronRight, X, UserCheck } from "lucide-react"
import {
  saveRoleAction, createRoleAction, deleteRoleAction,
  type RoleRow,
} from "@/app/(app)/settings/roles/actions"
import type { RolePermissions } from "@/lib/permissions"
import { getDefaultPermissions } from "@/lib/permissions"

// ── Primitives ───────────────────────────────────────────────────

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

function Btn({
  onClick, children, variant = "primary", disabled, small,
}: {
  onClick?: () => void; children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; small?: boolean
}) {
  const sz = small ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: "#2563eb", color: "white" },
    secondary: { border: "1px solid var(--border)", color: "var(--on-dark-soft)", background: "var(--card)" },
    danger:    { background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`${sz} rounded-lg font-medium flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-40`}
      style={styles[variant]}>
      {children}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-10 px-3 rounded-lg text-sm outline-none"
      style={{ border: "1.5px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)" }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
    />
  )
}

function Checkbox({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className="flex-shrink-0 w-4 h-4 rounded transition-colors mt-0.5 flex items-center justify-center"
        style={{ background: checked ? "#2563eb" : "transparent", border: checked ? "none" : "1.5px solid var(--border)" }}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </div>
      <div>
        <p className="text-sm" style={{ color: "var(--on-dark)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{description}</p>}
      </div>
    </label>
  )
}

// ── Permission modules config ────────────────────────────────────

type ModuleCfg = {
  key: keyof RolePermissions
  label: string
  emoji: string
  actions: { key: string; label: string; description?: string }[]
}

const MODULES: ModuleCfg[] = [
  {
    key: "dashboard", label: "Дашборд", emoji: "📊",
    actions: [
      { key: "view",         label: "Просмотр" },
      { key: "view_finance", label: "Просмотр финансов", description: "Выручка и доходы" },
    ],
  },
  {
    key: "clients", label: "Клиенты", emoji: "👥",
    actions: [
      { key: "view",    label: "Просмотр" },
      { key: "create",  label: "Создание" },
      { key: "edit",    label: "Редактирование" },
      { key: "delete",  label: "Удаление" },
      { key: "freeze",  label: "Заморозка абонемента" },
      { key: "extend",  label: "Продление абонемента" },
      { key: "export",  label: "Экспорт" },
    ],
  },
  {
    key: "memberships", label: "Абонементы", emoji: "🎫",
    actions: [
      { key: "view",         label: "Просмотр" },
      { key: "sell",         label: "Продажа" },
      { key: "create",       label: "Создание шаблонов" },
      { key: "edit",         label: "Редактирование" },
      { key: "delete",       label: "Удаление" },
      { key: "change_price", label: "Изменение цены" },
    ],
  },
  {
    key: "payments", label: "Оплаты", emoji: "💳",
    actions: [
      { key: "view",         label: "Просмотр" },
      { key: "create",       label: "Создание" },
      { key: "refund",       label: "Возврат" },
      { key: "view_revenue", label: "Просмотр прибыли" },
      { key: "export",       label: "Экспорт" },
    ],
  },
  {
    key: "visits", label: "Посещения", emoji: "🏋",
    actions: [
      { key: "view",           label: "Просмотр" },
      { key: "checkin",        label: "Check-in" },
      { key: "checkout",       label: "Check-out" },
      { key: "manual",         label: "Ручное посещение" },
      { key: "delete_history", label: "Удаление истории" },
    ],
  },
  {
    key: "schedule", label: "Расписание", emoji: "📅",
    actions: [
      { key: "view",   label: "Просмотр" },
      { key: "create", label: "Создание" },
      { key: "edit",   label: "Редактирование" },
      { key: "delete", label: "Удаление" },
    ],
  },
  {
    key: "warehouse", label: "Склад", emoji: "📦",
    actions: [
      { key: "view",            label: "Просмотр" },
      { key: "sell",            label: "Продажа" },
      { key: "supply",          label: "Поставка" },
      { key: "writeoff",        label: "Списание" },
      { key: "view_cost_price", label: "Закупочная цена", description: "Скрыть от обычных сотрудников" },
    ],
  },
  {
    key: "staff", label: "Сотрудники", emoji: "👨‍💼",
    actions: [
      { key: "view",     label: "Просмотр" },
      { key: "create",   label: "Приглашение" },
      { key: "edit",     label: "Редактирование" },
      { key: "delete",   label: "Удаление" },
      { key: "salaries", label: "Зарплаты" },
    ],
  },
  {
    key: "reports", label: "Отчёты", emoji: "📈",
    actions: [
      { key: "view",    label: "Просмотр" },
      { key: "finance", label: "Финансовые данные" },
      { key: "export",  label: "Экспорт" },
    ],
  },
  {
    key: "ai", label: "AI Аналитика", emoji: "🤖",
    actions: [
      { key: "use", label: "Использовать AI" },
    ],
  },
  {
    key: "telegram", label: "Telegram", emoji: "📱",
    actions: [
      { key: "view",   label: "Просмотр" },
      { key: "manage", label: "Управление ботом и рассылками" },
    ],
  },
  {
    key: "settings", label: "Настройки", emoji: "⚙️",
    actions: [
      { key: "general",       label: "Основные настройки" },
      { key: "integrations",  label: "Интеграции" },
      { key: "subscription",  label: "Подписка" },
      { key: "roles",         label: "Роли и права" },
    ],
  },
]

// ── New role templates ───────────────────────────────────────────

const TEMPLATES = [
  { key: "admin",      label: "Администратор",   desc: "Управление клиентами и операциями" },
  { key: "manager",    label: "Менеджер",         desc: "Продажи и работа с клиентами" },
  { key: "trainer",    label: "Тренер",           desc: "Работа с клиентами и расписанием" },
  { key: "accountant", label: "Бухгалтер",        desc: "Финансы и отчётность" },
  { key: "cashier",    label: "Кассир",           desc: "Продажи и посещения" },
  { key: "custom",     label: "Своя роль",        desc: "Начать с нуля" },
]

// ── Permission editor ────────────────────────────────────────────

function PermissionModule({
  mod, permissions, onChange, disabled,
}: {
  mod: ModuleCfg
  permissions: RolePermissions
  onChange: (mod: keyof RolePermissions, action: string, val: boolean) => void
  disabled: boolean
}) {
  const modPerms = permissions[mod.key] as Record<string, boolean>

  const allChecked = mod.actions.every((a) => modPerms[a.key])
  const toggleAll = () => {
    const newVal = !allChecked
    for (const a of mod.actions) onChange(mod.key, a.key, newVal)
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: "var(--card-2)" }}
        onClick={disabled ? undefined : toggleAll}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{mod.emoji}</span>
          <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{mod.label}</span>
        </div>
        {!disabled && (
          <div
            className="flex-shrink-0 w-4 h-4 rounded transition-colors flex items-center justify-center"
            style={{ background: allChecked ? "#2563eb" : "transparent", border: allChecked ? "none" : "1.5px solid var(--border)" }}
          >
            {allChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
        )}
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {mod.actions.map((a) => (
          <Checkbox
            key={a.key}
            checked={modPerms[a.key] ?? false}
            onChange={(v) => !disabled && onChange(mod.key, a.key, v)}
            label={a.label}
            description={a.description}
          />
        ))}
      </div>
    </div>
  )
}

// ── Create role modal ────────────────────────────────────────────

function CreateRoleModal({
  onClose, onCreated, assignStaffId, assignStaffName,
}: {
  onClose: () => void
  onCreated: (role: RoleRow) => void
  assignStaffId?: string
  assignStaffName?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<"template" | "form">("template")
  const [templateKey, setTemplateKey] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start] = useTransition()

  function chooseTemplate(key: string) {
    setTemplateKey(key)
    const tpl = TEMPLATES.find((t) => t.key === key)
    if (key !== "custom" && tpl) {
      setName(tpl.label)
      setDesc(tpl.desc)
    }
    setStep("form")
  }

  function handleCreate() {
    if (!name.trim()) return
    setMsg(null)
    start(async () => {
      const baseKey = templateKey !== "custom" ? (templateKey ?? "trainer") : "trainer"
      const permissions = getDefaultPermissions(baseKey)
      const res = await createRoleAction({
        name: name.trim(),
        description: desc.trim(),
        permissions,
        templateKey: baseKey,
        assignToStaffId: assignStaffId,
      })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }

      const newRole: RoleRow = {
        id: res.id!,
        key: res.key ?? `custom_${Date.now()}`,
        name: name.trim(),
        description: desc.trim(),
        permissions,
        isSystem: false,
        staffCount: assignStaffId ? 1 : 0,
      }
      onCreated(newRole)

      // If we came from a staff page, redirect back after assignment
      if (assignStaffId) {
        router.push(`/staff/${assignStaffId}`)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(2,6,23,0.4)" }} onClick={onClose}>
      <div className="flex h-full w-full max-w-[480px] flex-col overflow-hidden" style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
            {step === "template" ? "Выберите шаблон" : "Новая роль"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {assignStaffName && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" }}>
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              Роль будет назначена: <span className="font-semibold">{assignStaffName}</span>
            </div>
          )}
          {step === "template" ? (
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => chooseTemplate(t.key)}
                  className="w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  style={{ border: "1px solid var(--border-subtle)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{t.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{t.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray-muted)" }} />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Название роли">
                <TextInput value={name} onChange={setName} placeholder="Например: Старший тренер" />
              </Field>
              <Field label="Описание">
                <TextInput value={desc} onChange={setDesc} placeholder="Краткое описание обязанностей" />
              </Field>
              {msg && <Alert msg={msg.text} type={msg.type} />}
              <div className="flex gap-2 pt-1">
                <Btn onClick={handleCreate} disabled={pending || !name.trim()}>
                  {pending ? "Создание..." : "Создать роль"}
                </Btn>
                <Btn variant="secondary" onClick={() => setStep("template")}>Назад</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Role editor panel ────────────────────────────────────────────

function RoleEditor({
  role, onSaved, onDeleted, isOwner,
}: {
  role: RoleRow
  onSaved: (role: RoleRow) => void
  onDeleted: (id: string) => void
  isOwner: boolean
}) {
  const [name, setName] = useState(role.name)
  const [desc, setDesc] = useState(role.description)
  const [perms, setPerms] = useState<RolePermissions>(role.permissions)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null)
  const [pending, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const disabled = !isOwner || role.key === "owner"

  function handlePermChange(mod: keyof RolePermissions, action: string, val: boolean) {
    setPerms((prev) => ({
      ...prev,
      [mod]: { ...(prev[mod] as Record<string, boolean>), [action]: val },
    }))
  }

  function handleSave() {
    setMsg(null)
    start(async () => {
      const res = await saveRoleAction(role.id, { name, description: desc, permissions: perms })
      if (res.error) { setMsg({ text: res.error, type: "err" }); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSaved({ ...role, name, description: desc, permissions: perms })
    })
  }

  function handleDelete() {
    start(async () => {
      const res = await deleteRoleAction(role.id)
      if (res.error) { setMsg({ text: res.error, type: "err" }); setConfirmDelete(false); return }
      onDeleted(role.id)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <Field label="Название">
                <TextInput value={name} onChange={setName} placeholder="Название роли" />
              </Field>
              <Field label="Описание">
                <TextInput value={desc} onChange={setDesc} placeholder="Краткое описание" />
              </Field>
            </div>
            <div className="self-start sm:shrink-0 sm:pt-5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                <Users className="w-3 h-3" />
                {role.staffCount} чел.
              </div>
            </div>
          </div>
          {role.isSystem && (
            <div className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: "var(--gray-muted)" }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="min-w-0">Системная роль — ограничения нельзя убрать, но права можно настроить</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!disabled && (
              <button
                onClick={handleSave}
                disabled={pending}
                className="h-9 px-5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#2563eb" }}
              >
                {saved ? <><Check className="w-4 h-4" />Сохранено</> : pending ? "Сохранение..." : "Сохранить"}
              </button>
            )}
            {msg && <Alert msg={msg.text} type={msg.type} />}
          </div>
          {!role.isSystem && isOwner && !confirmDelete && (
            <Btn variant="danger" small onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Удалить роль
            </Btn>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Удалить роль?</span>
              <Btn variant="danger" small onClick={handleDelete} disabled={pending}>Да, удалить</Btn>
              <Btn variant="secondary" small onClick={() => setConfirmDelete(false)}>Отмена</Btn>
            </div>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--card)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Права доступа</h3>
          {disabled && role.key === "owner" && (
            <p className="text-xs mt-1" style={{ color: "var(--gray-muted)" }}>Владелец всегда имеет полный доступ</p>
          )}
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {MODULES.map((mod) => (
            <div key={mod.key} className="px-6 py-4" style={{ background: "var(--card)" }}>
              <PermissionModule
                mod={mod}
                permissions={perms}
                onChange={handlePermChange}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export function RolesSettings({
  roles: initialRoles,
  isOwner,
  assignStaffId,
  assignStaffName,
}: {
  roles: RoleRow[]
  isOwner: boolean
  assignStaffId?: string
  assignStaffName?: string
}) {
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles)
  const [selectedId, setSelectedId] = useState<string | null>(initialRoles[0]?.id ?? null)
  const [showCreate, setShowCreate] = useState(!!assignStaffId)

  const selected = roles.find((r) => r.id === selectedId) ?? null

  function handleSaved(updated: RoleRow) {
    setRoles((prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  function handleDeleted(id: string) {
    const remaining = roles.filter((r) => r.id !== id)
    setRoles(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  function handleCreated(role: RoleRow) {
    setRoles((prev) => [...prev, role])
    setSelectedId(role.id)
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col" style={{ gap: 20 }}>
      <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.144px", color: "var(--on-dark)" }}>
        Роли и права
      </h1>

      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-2">
          <select
            aria-label="Выберите роль"
            value={selectedId ?? ""}
            onChange={(event) => setSelectedId(event.target.value || null)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-label="Создать роль"
              title="Создать роль"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {selected ? (
          <RoleEditor
            key={selected.id}
            role={selected}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            isOwner={isOwner}
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Выберите роль
          </div>
        )}
      </div>

      <div className="hidden gap-4 overflow-hidden sm:flex" style={{ height: "calc(100svh - 196px)", minHeight: 400 }}>
        {/* Left: role list */}
        <div className="w-56 flex-shrink-0 rounded-lg overflow-y-auto flex flex-col" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>Роли</p>
          </div>
          <div className="py-1">
            {roles.map((role) => {
              const active = role.id === selectedId
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className="w-full text-left px-4 py-2.5 transition-colors"
                  style={{
                    background: active ? "var(--card-2)" : "transparent",
                    borderLeft: active ? "2px solid #2563eb" : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate" style={{ color: active ? "var(--on-dark)" : "var(--on-dark-soft)", fontWeight: active ? 500 : 400 }}>
                      {role.name}
                    </span>
                    {role.staffCount > 0 && (
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--gray-muted)" }}>{role.staffCount}</span>
                    )}
                  </div>
                  {role.isSystem && (
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--gray-muted)" }}>Системная</p>
                  )}
                </button>
              )
            })}
          </div>
          {isOwner && (
            <div className="p-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                style={{ color: "#2563eb" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Создать роль
              </button>
            </div>
          )}
        </div>

        {/* Right: role editor */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selected ? (
            <RoleEditor
              key={selected.id}
              role={selected}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              isOwner={isOwner}
            />
          ) : (
            <div className="flex items-center justify-center h-48 rounded-lg" style={{ border: "1px dashed var(--border)", color: "var(--gray-muted)", fontSize: 14 }}>
              Выберите роль слева
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          assignStaffId={assignStaffId}
          assignStaffName={assignStaffName}
        />
      )}
    </div>
  )
}
