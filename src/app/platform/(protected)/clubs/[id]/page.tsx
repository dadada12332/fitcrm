import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Calendar, Users, CreditCard, Activity, Wallet } from "lucide-react"
import { getClubDetail, platformBase } from "@/lib/platform"
import { getPlans } from "@/lib/plans"
import { fmtMoney } from "@/lib/money"
import {
  Panel, PlanBadge, StatusBadge, HealthBadge,
  fmtNum, fmtSum, fmtDate, timeAgo, PT,
} from "@/components/platform/parts"
import { ClubActions } from "@/components/platform/ClubActions"

export const dynamic = "force-dynamic"

const PROVIDER_LABEL: Record<string, string> = { cash: "Наличные", click: "Click", payme: "Payme", uzum: "Uzum" }

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [club, base, allPlans] = await Promise.all([getClubDetail(id), platformBase(), getPlans({ includeArchived: true })])
  if (!club) notFound()

  const clubPlan = allPlans.find((p) => p.code === club.plan)
  // Цена: зафиксированная за клубом (grandfather) → иначе актуальная цена тарифа.
  const planPrice = club.planPriceLocked ?? clubPlan?.price ?? 0
  const planCur = clubPlan?.currency ?? "UZS"
  const priceLabel = club.plan === "trial" ? "Бесплатно" : `${fmtMoney(planPrice, planCur)}/${clubPlan?.period === "yearly" ? "год" : clubPlan?.period === "quarterly" ? "кв" : "мес"}`

  const expiry = club.plan === "trial" ? club.trialExpiresAt : club.planExpiresAt
  const info = [
    { icon: <Mail className="w-4 h-4" />, label: "Email владельца", value: club.ownerEmail ?? "—" },
    { icon: <Users className="w-4 h-4" />, label: "Владелец", value: club.ownerName ?? "—" },
    { icon: <MapPin className="w-4 h-4" />, label: "Город", value: club.city ?? "—" },
    { icon: <Calendar className="w-4 h-4" />, label: "Регистрация", value: fmtDate(club.createdAt) },
    { icon: <CreditCard className="w-4 h-4" />, label: "Стоимость плана", value: priceLabel },
    { icon: <Calendar className="w-4 h-4" />, label: club.plan === "trial" ? "Trial до" : "Оплачено до", value: fmtDate(expiry) },
  ]

  const usage = [
    { icon: <Users className="w-5 h-5" style={{ color: "#60a5fa" }} />, label: "Клиентов", value: fmtNum(club.clientsCount) },
    { icon: <Users className="w-5 h-5" style={{ color: "#a78bfa" }} />, label: "В команде", value: fmtNum(club.staffCount) },
    { icon: <Activity className="w-5 h-5" style={{ color: "#4ade80" }} />, label: "Визитов 30д", value: fmtNum(club.visits30) },
    { icon: <CreditCard className="w-5 h-5" style={{ color: "#fbbf24" }} />, label: "Активных абонементов", value: fmtNum(club.activeSubscriptions) },
    { icon: <Wallet className="w-5 h-5" style={{ color: "#34d399" }} />, label: "Выручка 30д", value: fmtSum(club.revenue30) },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-[1300px] mx-auto">
      <Link href={`${base}/clubs`} className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors hover:text-white" style={{ color: PT.textMuted }}>
        <ArrowLeft className="w-4 h-4" /> Все клубы
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-semibold text-white shrink-0" style={{ background: "#312e81" }}>
            {club.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-[-0.3px]">{club.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <PlanBadge plan={club.plan} />
              <StatusBadge status={club.status} />
              <HealthBadge score={club.health} />
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <Panel className="px-4 py-3.5 mb-5">
        <ClubActions
          clubId={club.id}
          status={club.status}
          plan={club.plan}
          plans={allPlans.filter((p) => p.is_active).map((p) => ({ code: p.code, name: p.name, price: p.price, currency: p.currency, is_trial: p.is_trial }))}
        />
      </Panel>

      {/* Usage tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {usage.map((u, i) => (
          <Panel key={i} className="px-4 py-3.5">
            <div className="mb-2">{u.icon}</div>
            <p className="text-[22px] font-semibold text-white tracking-[-0.3px] leading-none">{u.value}</p>
            <p className="text-[11px] mt-1.5" style={{ color: PT.textMuted }}>{u.label}</p>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Info */}
        <Panel className="lg:col-span-1">
          <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <span className="text-sm font-semibold text-white">Информация</span>
          </div>
          <div className="p-2">
            {info.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                <span style={{ color: PT.textMuted }}>{r.icon}</span>
                <span className="text-xs flex-1" style={{ color: PT.textMuted }}>{r.label}</span>
                <span className="text-sm text-right truncate max-w-[160px]" style={{ color: PT.text }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent payments */}
        <Panel className="lg:col-span-2">
          <div className="px-4 h-12 flex items-center justify-between" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
            <span className="text-sm font-semibold text-white">Последние оплаты</span>
            <span className="text-xs" style={{ color: PT.textMuted }}>{club.paymentsCount} за 30 дней</span>
          </div>
          <div className="p-2">
            {club.recentPayments.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: PT.textMuted }}>Оплат пока нет</p>
            ) : club.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-2.5 py-2.5" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}>
                  <CreditCard className="w-4 h-4" style={{ color: "#4ade80" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{p.clientName ?? "Без клиента"}</p>
                  <p className="text-[11px]" style={{ color: PT.textMuted }}>{PROVIDER_LABEL[p.provider] ?? p.provider} · {timeAgo(p.createdAt)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums" style={{ color: "#4ade80" }}>{fmtSum(p.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Staff */}
      <Panel className="mt-4">
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <span className="text-sm font-semibold text-white">Команда ({club.staff.length})</span>
        </div>
        <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
          {club.staff.length === 0 ? (
            <p className="text-sm py-6 px-2.5 col-span-full" style={{ color: PT.textMuted }}>Сотрудники не добавлены</p>
          ) : club.staff.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: "#4338ca" }}>
                {(s.name ?? s.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{s.name ?? s.email ?? "—"}</p>
                <p className="text-[11px] capitalize" style={{ color: PT.textMuted }}>{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
