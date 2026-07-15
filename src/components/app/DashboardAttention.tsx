import Link from "next/link"
import { ArrowRight, Clock, CreditCard, UserX, Cake } from "lucide-react"

type AttentionCard = {
  count: number
  icon: React.ReactNode
  title: string
  description: string
  action: string
  href: string
  color: string
  bg: string
  border: string
}

function AttCard({ card }: { card: AttentionCard }) {
  if (card.count === 0) return null
  return (
    <Link
      href={card.href}
      className="group rounded-xl p-4 flex items-center gap-4 transition-all hover:scale-[1.01]"
      style={{ background: card.bg, border: `1px solid ${card.border}` }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: card.color + "22" }}>
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums" style={{ color: card.color }}>{card.count}</span>
          <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{card.title}</span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{card.description}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs font-medium" style={{ color: card.color }}>{card.action}</span>
        <ArrowRight className="w-3.5 h-3.5" style={{ color: card.color }} />
      </div>
    </Link>
  )
}

type Props = {
  expiringCount: number
  debtCount: number
  churnCount: number
  birthdaysToday: number
}

export function DashboardAttention({ expiringCount, debtCount, churnCount, birthdaysToday }: Props) {
  const total = expiringCount + debtCount + churnCount + birthdaysToday
  if (total === 0) return null

  const cards: AttentionCard[] = [
    {
      count: expiringCount,
      icon: <Clock className="w-5 h-5" style={{ color: "#d97706" }} />,
      title: "клиентов",
      description: "Истекает абонемент в ближайшие 7 дней",
      action: "Продлить",
      href: "/clients",
      color: "#d97706",
      bg: "rgba(217,119,6,0.04)",
      border: "rgba(217,119,6,0.18)",
    },
    {
      count: debtCount,
      icon: <CreditCard className="w-5 h-5" style={{ color: "#dc2626" }} />,
      title: "клиентов",
      description: "Есть задолженность по оплате",
      action: "Посмотреть",
      href: "/clients",
      color: "#dc2626",
      bg: "rgba(220,38,38,0.04)",
      border: "rgba(220,38,38,0.18)",
    },
    {
      count: churnCount,
      icon: <UserX className="w-5 h-5" style={{ color: "#64748b" }} />,
      title: "клиентов",
      description: "Не посещали клуб более 30 дней",
      action: "Вернуть",
      href: "/clients",
      color: "#64748b",
      bg: "var(--card-2)",
      border: "var(--border)",
    },
    {
      count: birthdaysToday,
      icon: <Cake className="w-5 h-5" style={{ color: "#7c3aed" }} />,
      title: "дня рождения",
      description: "Сегодня",
      action: "Поздравить",
      href: "/clients",
      color: "#7c3aed",
      bg: "rgba(124,58,237,0.04)",
      border: "rgba(124,58,237,0.18)",
    },
  ]

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--on-dark)" }}>Требует внимания</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{total} задач ждут вас</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
          {total}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {cards.map((c, i) => <AttCard key={i} card={c} />)}
      </div>
    </div>
  )
}
