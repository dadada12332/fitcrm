"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { Search, Plus, Users, UserCheck, Wallet, ChevronRight } from "lucide-react"
import { type StaffRow, type StaffKPI, ROLE_LABELS } from "@/lib/staff"
import { addStaffAction } from "@/app/(app)/staff/actions"

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("ru-RU") }

const STATUS_META = {
  active:   { label: "Активен",  bg: "#dcfce7", color: "#16a34a" },
  vacation: { label: "Отпуск",   bg: "#fef9c3", color: "#ca8a04" },
  fired:    { label: "Уволен",   bg: "#fee2e2", color: "#dc2626" },
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string
  icon: typeof Users; accent: string
}) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
        <Icon className="w-5 h-5" style={{ color: "white" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--gray-muted)" }}>{label}</p>
        <p className="text-2xl font-bold leading-none" style={{ color: "var(--on-dark)" }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Add Staff Modal ───────────────────────────────────────────────

const SALARY_TYPES = [
  { key: "fixed",   label: "Фикс" },
  { key: "percent", label: "Процент" },
  { key: "mixed",   label: "Фикс + Процент" },
]

function AddStaffModal({ onClose, onAdded }: { onClose: () => void; onAdded: (row: any) => void }) {
  const [name, setName]       = useState("")
  const [email, setEmail]     = useState("")
  const [phone, setPhone]     = useState("")
  const [role, setRole]       = useState("trainer")
  const [salType, setSalType] = useState("fixed")
  const [fixed, setFixed]     = useState("")
  const [pct, setPct]         = useState("20")
  const [error, setError]     = useState<string | null>(null)
  const [pending, start]      = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (!name.trim() || !email.trim()) { setError("Имя и Email обязательны"); return }
    start(async () => {
      const res = await addStaffAction({
        name: name.trim(), email: email.trim(), phone: phone.trim(), role,
        salaryType: salType, salaryFixed: Number(fixed) || 0, salaryPercent: Number(pct) || 0,
      })
      if (res.error) { setError(res.error); return }
      onAdded({ id: res.id, name: name.trim(), email: email.trim(), role, status: "active", clientCount: 0, revenue: 0, salary: Number(fixed) || 0, settings: {} })
      onClose()
    })
  }

  const inp = "w-full h-10 px-3 rounded-lg text-sm outline-none"
  const inpStyle = { border: "1.5px solid #e2e8f0", color: "var(--on-dark)" }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Добавить сотрудника</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ color: "var(--gray-muted)" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--on-dark-soft)" }}>Имя и фамилия</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Азиз Каримов"
                className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--on-dark-soft)" }}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aziz@club.uz" type="email"
                className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--on-dark-soft)" }}>Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" type="tel"
                className={inp} style={inpStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Роль</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== "owner").map(([k, v]) => (
                <button key={k} type="button" onClick={() => setRole(k)}
                  className="h-9 rounded-lg text-sm font-medium transition-all"
                  style={{
                    border: `1.5px solid ${role === k ? "#2563eb" : "var(--border)"}`,
                    background: role === k ? "rgba(37,99,235,0.12)" : "var(--card)",
                    color: role === k ? "#2563eb" : "var(--on-dark-soft)",
                  }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Тип зарплаты</label>
            <div className="flex gap-2">
              {SALARY_TYPES.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setSalType(key)}
                  className="flex-1 h-9 rounded-lg text-xs font-medium transition-all"
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

          <div className="grid grid-cols-2 gap-3">
            {(salType === "fixed" || salType === "mixed") && (
              <div className={salType === "fixed" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--on-dark-soft)" }}>Фикс (сум)</label>
                <input value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="4 000 000" type="number"
                  className={inp} style={inpStyle} />
              </div>
            )}
            {(salType === "percent" || salType === "mixed") && (
              <div className={salType === "percent" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--on-dark-soft)" }}>Процент (%)</label>
                <input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20" type="number"
                  className={inp} style={inpStyle} />
              </div>
            )}
          </div>

          {error && <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
              Отмена
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 h-10 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "#2563eb" }}>
              {pending ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export function StaffClient({ kpi, rows }: { kpi: StaffKPI; rows: StaffRow[] }) {
  const [query, setQuery]     = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [showModal, setShowModal]   = useState(false)
  const [list, setList]       = useState(rows)

  const filtered = useMemo(() => {
    return list.filter((r) => {
      const q = query.trim().toLowerCase()
      if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false
      if (roleFilter !== "all" && r.role !== roleFilter) return false
      return true
    })
  }, [list, query, roleFilter])

  const ROLE_FILTERS = [
    { key: "all",      label: "Все" },
    { key: "trainer",  label: "Тренеры" },
    { key: "admin",    label: "Администраторы" },
    { key: "manager",  label: "Менеджеры" },
  ]

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Всего сотрудников" value={String(kpi.total)}      icon={Users}      accent="#2563eb" />
        <KpiCard label="Тренеров"           value={String(kpi.trainers)}   icon={UserCheck}  accent="#7c3aed" />
        <KpiCard label="Администраторов"    value={String(kpi.admins)}     icon={Users}      accent="#0891b2" />
        <KpiCard label="Зарплата за месяц"  value={fmt(kpi.monthlySalary)} sub="сум / месяц" icon={Wallet} accent="#059669" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--gray-muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск сотрудника..."
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
            style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--on-dark)" }} />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--card-2)" }}>
          {ROLE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setRoleFilter(f.key)}
              className="h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: roleFilter === f.key ? "var(--pill-active)" : "transparent",
                color: roleFilter === f.key ? "var(--on-dark)" : "var(--on-dark-soft)",
                boxShadow: roleFilter === f.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowModal(true)}
          className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: "#2563eb" }}>
          <Plus className="w-4 h-4" /> Добавить сотрудника
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{filtered.length} сотрудников</p>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--gray-muted)" }}>Сотрудников нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Сотрудник","Роль","Клиенты","Зарплата","Статус",""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const sm = STATUS_META[row.status] ?? STATUS_META.active
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                            style={{ background: "#3b82f6" }}>
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ color: "var(--on-dark)" }}>{row.name}</p>
                            <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                          {ROLE_LABELS[row.role] ?? row.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>
                        {row.clientCount > 0 ? row.clientCount : "—"}
                      </td>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--on-dark)" }}>
                        {row.salary > 0 ? `${fmt(row.salary)} сум` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/staff/${row.id}`}
                          className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-blue-600"
                          style={{ color: "var(--gray-muted)" }}>
                          Открыть <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddStaffModal
          onClose={() => setShowModal(false)}
          onAdded={(row) => setList((prev) => [...prev, row])}
        />
      )}
    </>
  )
}
