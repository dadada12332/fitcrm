"use client"

import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Download, SlidersHorizontal, CalendarCheck, CreditCard, UserPlus, Snowflake, User, Clock } from "lucide-react"
import {
  type ClientProfile,
  type ProfilePayment,
  type ProfileVisit,
  providerMeta,
  paymentStatusMeta,
  visitMethodMeta,
} from "@/lib/client-profile"
import { downloadCSV } from "@/lib/csv"

type TabKey = "profile" | "visits" | "payments" | "history"

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: "profile",  label: "Профиль",   icon: User },
  { key: "visits",   label: "Посещения", icon: CalendarCheck },
  { key: "payments", label: "Платежи",   icon: CreditCard },
  { key: "history",  label: "История",   icon: Clock },
]

function fmtSum(n: number) {
  return `${n.toLocaleString("ru-RU")} сум`
}
function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

const UNKNOWN_META = { label: "—", bg: "var(--card-2)", color: "var(--on-dark-soft)" }

function Badge({ meta }: { meta?: { label: string; bg: string; color: string } | null }) {
  const m = meta ?? UNKNOWN_META
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg ${className}`} style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  )
}

function MobileDetail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{label}</span>
      <div className="min-w-0 text-sm" style={{ color: "var(--on-dark)" }}>{children}</div>
    </div>
  )
}

export function ClientProfileTabs({ client }: { client: ClientProfile }) {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "profile"
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "profile"
  )

  useEffect(() => {
    const t = searchParams.get("tab") as TabKey | null
    // Browser navigation can change the active deep-linked tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS.some((x) => x.key === t)) setTab(t)
  }, [searchParams])

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="grid w-full grid-cols-4 gap-0.5 rounded-lg p-1 sm:flex sm:overflow-x-auto" style={{ background: "var(--card-2)" }}>
        {TABS.map((t) => {
          const active = t.key === tab
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex h-9 min-w-0 items-center justify-center rounded-md px-1 text-[11px] font-medium transition-colors sm:flex-shrink-0 sm:gap-1.5 sm:px-3 sm:text-sm"
              style={active
                ? { background: "var(--card)", color: "var(--on-dark)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                : { background: "transparent", color: "var(--on-dark-soft)" }}
            >
              <Icon className="hidden w-4 h-4 flex-shrink-0 sm:block" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "profile" && <ProfileTab client={client} />}
      {tab === "visits" && <VisitsTab visits={client.visits} />}
      {tab === "payments" && <PaymentsTab payments={client.payments} />}
      {tab === "history" && <HistoryTab client={client} />}
    </div>
  )
}

/* ───────────────────────── Профиль ───────────────────────── */

function ProfileTab({ client }: { client: ClientProfile }) {
  const sub = client.subscription
  return (
    <>
      {/* Карточка абонемента */}
      <Card className="p-4 sm:p-6">
        {sub ? (
          <>
            <div className="flex flex-col items-center text-center">
              <span className="px-3 py-0.5 rounded-full text-xs font-medium mb-2" style={{ background: "rgba(37,99,235,0.14)", color: "#2563eb" }}>
                Текущий
              </span>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--on-dark)" }}>{sub.name}</h3>
              <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
                {fmtDate(sub.startsAt)} — {fmtDate(sub.expiresAt)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <Mini label="Осталось дней" value={sub.daysLeft !== null ? String(sub.daysLeft) : "—"} />
              <Mini label="Посещений" value={`${sub.visitsUsed} из ${sub.visitsTotal ?? "∞"}`} />
              <Mini label="Заморозка" value={`${sub.freezeDaysAllowed - sub.freezeDaysUsed} дней`} />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span style={{ color: "var(--on-dark-soft)" }}>Использовано</span>
                <span className="font-medium" style={{ color: "var(--on-dark)" }}>{sub.usedPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${sub.usedPct}%`, background: "#2563eb" }} />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-center py-8" style={{ color: "var(--gray-muted)" }}>У клиента нет активного абонемента</p>
        )}
      </Card>

      {/* История транзакций */}
      <Card>
        <TransactionsTable payments={client.payments} />
      </Card>
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-4 py-3 flex flex-col items-center text-center" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--gray-muted)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "var(--on-dark)" }}>{value}</p>
    </div>
  )
}

function exportTransactions(payments: ProfilePayment[]) {
  const today = new Date().toISOString().slice(0, 10)
  downloadCSV(`transactions_${today}.csv`,
    ["Дата", "Сумма (сум)", "Способ оплаты", "Статус"],
    payments.map((p) => [
      p.paidAt ? new Date(p.paidAt).toLocaleDateString("ru-RU") : "—",
      p.amount,
      providerMeta[p.provider]?.label ?? p.provider,
      paymentStatusMeta[p.status]?.label ?? p.status,
    ]),
  )
}

function TransactionsTable({ payments }: { payments: ProfilePayment[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payments
    return payments.filter((p) =>
      (providerMeta[p.provider]?.label ?? p.provider).toLowerCase().includes(q) ||
      (paymentStatusMeta[p.status]?.label ?? p.status).toLowerCase().includes(q) ||
      String(p.amount).includes(q),
    )
  }, [payments, query])

  const cols = "minmax(120px,1fr) minmax(120px,1fr) minmax(120px,1fr) minmax(140px,1fr) minmax(110px,0.8fr)"

  return (
    <>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <span className="text-base font-medium tracking-[-0.12px] sm:text-xl" style={{ color: "var(--on-dark)" }}>История транзакций</span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              className="h-9 w-full rounded-md pl-9 pr-3 text-sm outline-none sm:w-[200px]"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium sm:w-auto"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
              <SlidersHorizontal className="w-4 h-4" />Фильтр
            </button>
            <button
              onClick={() => exportTransactions(filtered)}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:px-4"
              style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}>
              <Download className="w-4 h-4" />Экспорт в CSV
            </button>
          </div>
        </div>
      </div>

      <div className="hidden h-12 items-center px-6 text-sm sm:grid"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <span>Дата</span>
        <span>Сумма</span>
        <span>Категория</span>
        <span>Платёжная система</span>
        <span className="text-right">Статус</span>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>Транзакций нет</div>
      ) : (
        filtered.map((p) => (
          <div key={p.id}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:hidden" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <MobileDetail label="Дата">{fmtDate(p.paidAt)}</MobileDetail>
              <MobileDetail label="Сумма"><span className="font-medium">{fmtSum(p.amount)}</span></MobileDetail>
              <MobileDetail label="Категория">Абонемент</MobileDetail>
              <MobileDetail label="Платёжная система"><Badge meta={providerMeta[p.provider] ?? null} /></MobileDetail>
              <MobileDetail label="Статус"><Badge meta={paymentStatusMeta[p.status] ?? null} /></MobileDetail>
            </div>
            <div className="hidden h-[60px] items-center px-6 text-sm sm:grid" style={{ gridTemplateColumns: cols, borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--on-dark-soft)" }}>{fmtDate(p.paidAt)}</span>
              <span className="font-medium" style={{ color: "var(--on-dark)" }}>{fmtSum(p.amount)}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>Абонемент</span>
              <span><Badge meta={providerMeta[p.provider] ?? null} /></span>
              <span className="flex justify-end"><Badge meta={paymentStatusMeta[p.status] ?? null} /></span>
            </div>
          </div>
        ))
      )}

      <div className="px-4 py-4 text-sm sm:px-6" style={{ color: "var(--gray-muted)" }}>{filtered.length} транзакций</div>
    </>
  )
}

/* ───────────────────────── Посещения ───────────────────────── */

function VisitsTab({ visits }: { visits: ProfileVisit[] }) {
  const cols = "minmax(140px,1fr) minmax(120px,1fr) minmax(140px,0.8fr)"
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <span className="text-base font-medium tracking-[-0.12px] sm:text-xl" style={{ color: "var(--on-dark)" }}>Посещения</span>
        <span className="text-sm" style={{ color: "var(--gray-muted)" }}>{visits.length} всего</span>
      </div>
      <div className="hidden h-12 items-center px-6 text-sm sm:grid"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <span>Дата</span>
        <span>Время</span>
        <span className="text-right">Метод</span>
      </div>
      {visits.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>Посещений нет</div>
      ) : (
        visits.map((v) => (
          <div key={v.id}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:hidden" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <MobileDetail label="Дата">{fmtDate(v.checkedInAt)}</MobileDetail>
              <MobileDetail label="Время">{fmtTime(v.checkedInAt)}</MobileDetail>
              <MobileDetail label="Метод"><Badge meta={visitMethodMeta[v.method] ?? null} /></MobileDetail>
            </div>
            <div className="hidden h-14 items-center px-6 text-sm sm:grid" style={{ gridTemplateColumns: cols, borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--on-dark-soft)" }}>{fmtDate(v.checkedInAt)}</span>
              <span style={{ color: "var(--on-dark-soft)" }}>{fmtTime(v.checkedInAt)}</span>
              <span className="flex justify-end"><Badge meta={visitMethodMeta[v.method] ?? null} /></span>
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

/* ───────────────────────── Платежи ───────────────────────── */

function PaymentsTab({ payments }: { payments: ProfilePayment[] }) {
  const total = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)
  const cols = "minmax(120px,1fr) minmax(120px,1fr) minmax(140px,1fr) minmax(110px,0.8fr)"
  return (
    <Card>
      <div className="flex flex-col items-start gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <span className="text-base font-medium tracking-[-0.12px] sm:text-xl" style={{ color: "var(--on-dark)" }}>Платежи</span>
        <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Всего оплачено: <span className="font-semibold" style={{ color: "var(--on-dark)" }}>{fmtSum(total)}</span></span>
      </div>
      <div className="hidden h-12 items-center px-6 text-sm sm:grid"
        style={{ gridTemplateColumns: cols, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <span>Дата</span>
        <span>Сумма</span>
        <span>Платёжная система</span>
        <span className="text-right">Статус</span>
      </div>
      {payments.length === 0 ? (
        <div className="px-6 py-12 text-sm text-center" style={{ color: "var(--gray-muted)" }}>Платежей нет</div>
      ) : (
        payments.map((p) => (
          <div key={p.id}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:hidden" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <MobileDetail label="Дата">{fmtDate(p.paidAt)}</MobileDetail>
              <MobileDetail label="Сумма"><span className="font-medium">{fmtSum(p.amount)}</span></MobileDetail>
              <MobileDetail label="Платёжная система"><Badge meta={providerMeta[p.provider] ?? null} /></MobileDetail>
              <MobileDetail label="Статус"><Badge meta={paymentStatusMeta[p.status] ?? null} /></MobileDetail>
            </div>
            <div className="hidden h-[60px] items-center px-6 text-sm sm:grid" style={{ gridTemplateColumns: cols, borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--on-dark-soft)" }}>{fmtDate(p.paidAt)}</span>
              <span className="font-medium" style={{ color: "var(--on-dark)" }}>{fmtSum(p.amount)}</span>
              <span><Badge meta={providerMeta[p.provider] ?? null} /></span>
              <span className="flex justify-end"><Badge meta={paymentStatusMeta[p.status] ?? null} /></span>
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

/* ───────────────────────── История (таймлайн) ───────────────────────── */

type TimelineItem = { id: string; ts: number; icon: typeof CreditCard; color: string; bg: string; title: string; sub: string }

function HistoryTab({ client }: { client: ClientProfile }) {
  const items = useMemo<TimelineItem[]>(() => {
    const arr: TimelineItem[] = []
    arr.push({
      id: "created", ts: new Date(client.createdAt).getTime(),
      icon: UserPlus, color: "#16a34a", bg: "rgba(22,163,74,0.14)",
      title: "Клиент зарегистрирован", sub: fmtDate(client.createdAt),
    })
    if (client.subscription) {
      arr.push({
        id: "sub", ts: new Date(client.subscription.startsAt ?? client.createdAt).getTime(),
        icon: Snowflake, color: "#2563eb", bg: "rgba(37,99,235,0.14)",
        title: `Оформлен абонемент «${client.subscription.name}»`,
        sub: `${fmtDate(client.subscription.startsAt)} — ${fmtDate(client.subscription.expiresAt)}`,
      })
    }
    for (const p of client.payments) {
      arr.push({
        id: `p-${p.id}`, ts: new Date(p.paidAt ?? client.createdAt).getTime(),
        icon: CreditCard, color: "#7c3aed", bg: "#ede9fe",
        title: `Платёж ${fmtSum(p.amount)}`,
        sub: `${providerMeta[p.provider].label} · ${fmtDate(p.paidAt)}`,
      })
    }
    for (const v of client.visits) {
      arr.push({
        id: `v-${v.id}`, ts: new Date(v.checkedInAt).getTime(),
        icon: CalendarCheck, color: "#0284c7", bg: "#e0f2fe",
        title: "Посещение зала",
        sub: `${fmtDate(v.checkedInAt)} ${fmtTime(v.checkedInAt)}`,
      })
    }
    return arr.sort((a, b) => b.ts - a.ts)
  }, [client])

  return (
    <Card className="p-4 sm:p-6">
      <span className="text-base font-medium tracking-[-0.12px] sm:text-xl" style={{ color: "var(--on-dark)" }}>История активности</span>
      <div className="mt-5 flex flex-col">
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <div key={it.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: it.bg }}>
                  <Icon className="w-4 h-4" style={{ color: it.color }} />
                </div>
                {i < items.length - 1 && <div className="w-px flex-1 my-1" style={{ background: "var(--border)" }} />}
              </div>
              <div className="pb-5">
                <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{it.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{it.sub}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
