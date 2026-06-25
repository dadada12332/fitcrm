import { createClient } from "@/lib/supabase/server"
import { getPaymentsKPI, getPaymentsList } from "@/lib/payments"
import { getActiveMemberships } from "@/lib/memberships"
import { PaymentsClient } from "@/components/app/PaymentsClient"
import { TrendingUp, TrendingDown, DollarSign, Receipt, Users } from "lucide-react"

function fmtSum(n: number) { return n.toLocaleString("ru-RU") }

function KPICard({ label, value, unit, pct, icon: Icon, iconColor }: {
  label: string; value: string; unit?: string; pct?: number; icon: typeof DollarSign; iconColor: string
}) {
  const up = pct !== undefined && pct >= 0
  return (
    <div className="rounded-xl px-5 py-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--gray-muted)" }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconColor + "18" }}>
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--on-dark)" }}>
          {value}{unit && <span className="text-sm font-normal ml-1" style={{ color: "var(--gray-muted)" }}>{unit}</span>}
        </p>
        {pct !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {up
              ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
              : <TrendingDown className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />}
            <span className="text-xs font-medium" style={{ color: up ? "#16a34a" : "#dc2626" }}>
              {up ? "+" : ""}{pct}% к прошлому периоду
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default async function PaymentsPage() {
  const supabase = await createClient()
  const [kpi, rows, memberships] = await Promise.all([
    getPaymentsKPI(supabase),
    getPaymentsList(supabase),
    getActiveMemberships(supabase),
  ])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Оплаты</h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Финансовый контроль клуба</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Выручка сегодня"
          value={fmtSum(kpi.todayRevenue)}
          unit="сум"
          pct={kpi.todayRevenuePct}
          icon={DollarSign}
          iconColor="#2563eb"
        />
        <KPICard
          label="Выручка за месяц"
          value={fmtSum(kpi.monthRevenue)}
          unit="сум"
          pct={kpi.monthRevenuePct}
          icon={TrendingUp}
          iconColor="#059669"
        />
        <KPICard
          label="Средний чек"
          value={fmtSum(kpi.avgCheck)}
          unit="сум"
          icon={Receipt}
          iconColor="#7c3aed"
        />
        <KPICard
          label="Ожидают оплаты"
          value={String(kpi.unpaidCount)}
          unit="платежей"
          icon={Users}
          iconColor="#d97706"
        />
      </div>

      {/* Table + filters */}
      <PaymentsClient rows={rows} memberships={memberships} />
    </div>
  )
}
