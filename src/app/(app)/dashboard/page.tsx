import { createClient } from "@/lib/supabase/server"
import { Users, CreditCard, Wallet, TrendingUp } from "lucide-react"

function formatSum(n: number) {
  return n.toLocaleString("ru-RU")
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [clientsRes, subsRes, visitsRes, paymentsRes] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .gte("checked_in_at", todayStart.toISOString()),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString()),
  ])

  const revenue = (paymentsRes.data ?? []).reduce(
    (sum, p: { amount: number }) => sum + Number(p.amount ?? 0),
    0,
  )

  const stats = [
    { label: "Активные клиенты", value: String(clientsRes.count ?? 0), icon: Users },
    { label: "Действующие абонементы", value: String(subsRes.count ?? 0), icon: CreditCard },
    { label: "Выручка за месяц", value: `${formatSum(revenue)} сум`, icon: Wallet },
    { label: "Посещений сегодня", value: String(visitsRes.count ?? 0), icon: TrendingUp },
  ]

  return (
    <div>
      <h1 className="text-3xl mb-1" style={{ color: "var(--on-dark)" }}>Дашборд</h1>
      <p className="text-sm mb-8" style={{ color: "var(--on-dark-soft)" }}>
        Обзор вашего клуба
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl p-6"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(37,99,235,0.15)" }}
            >
              <Icon className="w-5 h-5" style={{ color: "var(--orange)" }} />
            </div>
            <div className="text-3xl mb-1" style={{ color: "var(--on-dark)", fontFamily: "var(--font-display)" }}>
              {value}
            </div>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{label}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-8 mt-4 text-sm"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
      >
        Добавляйте клиентов и абонементы в соответствующих разделах — метрики обновятся автоматически.
        Следующие шаги: оформление абонементов клиентам, QR-чекин, оплаты.
      </div>
    </div>
  )
}
