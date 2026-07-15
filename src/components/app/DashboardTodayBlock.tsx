import { UserCheck, UserPlus, Banknote, Activity } from "lucide-react"

type StatItem = {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}

function Stat({ icon, label, value, color }: StatItem) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{label}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{value}</p>
    </div>
  )
}

type Props = {
  todayVisits: number
  todayNewClients: number
  todayPaymentsCount: number
}

export function DashboardTodayBlock({ todayVisits, todayNewClients, todayPaymentsCount }: Props) {
  const stats: StatItem[] = [
    {
      icon: <UserCheck className="w-4 h-4" style={{ color: "#2563eb" }} />,
      label: "Пришли сегодня",
      value: todayVisits,
      color: "#2563eb",
    },
    {
      icon: <UserPlus className="w-4 h-4" style={{ color: "#16a34a" }} />,
      label: "Новых клиентов",
      value: todayNewClients,
      color: "#16a34a",
    },
    {
      icon: <Banknote className="w-4 h-4" style={{ color: "#7c3aed" }} />,
      label: "Новых оплат",
      value: todayPaymentsCount,
      color: "#7c3aed",
    },
  ]

  const now = new Date()
  const hours = now.getHours()

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: "#2563eb" }} />
          <p className="text-[15px] font-semibold" style={{ color: "var(--on-dark)" }}>Сегодня в клубе</p>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>
          {hours}:{String(now.getMinutes()).padStart(2, "0")} · данные за сегодня
        </p>
      </div>
      <div className="px-5 pb-2">
        {stats.map((s, i) => (
          <div key={i} style={{ borderBottom: i < stats.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + "15" }}>
                {s.icon}
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{s.label}</p>
              </div>
              <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
