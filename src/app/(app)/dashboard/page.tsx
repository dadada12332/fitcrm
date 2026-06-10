import { createClient } from "@/lib/supabase/server"
import { Users, CreditCard, Wallet, TrendingUp } from "lucide-react"

const stats = [
  { label: "Активные клиенты", value: "—", icon: Users },
  { label: "Действующие абонементы", value: "—", icon: CreditCard },
  { label: "Выручка за месяц", value: "—", icon: Wallet },
  { label: "Посещений сегодня", value: "—", icon: TrendingUp },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="text-3xl mb-1" style={{ color: "var(--on-dark)" }}>
        Дашборд
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--on-dark-soft)" }}>
        Добро пожаловать, {user?.email}
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
        Здесь появятся графики и таблицы. Следующий шаг — подключение базы данных и реальных данных.
      </div>
    </div>
  )
}
