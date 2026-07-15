import { TrendingDown, AlertCircle, Clock, PackageX, HelpCircle, Calendar } from "lucide-react"

type Props = {
  attendanceChangePct: number
  churnCount: number
  expiringCount: number
  potentialLoss: number
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU")
}

export function ClubAnalytics({ attendanceChangePct, churnCount, expiringCount, potentialLoss }: Props) {
  const attendanceDown = Math.abs(Math.round(attendanceChangePct))

  const cards = [
    {
      icon: TrendingDown,
      title: "Снижение посещаемости",
      body: (
        <p className="text-sm leading-5" style={{ color: "var(--on-dark-soft)" }}>
          За последние 7 дней посещаемость {attendanceChangePct <= 0 ? "снизилась" : "выросла"} на {attendanceDown}%
        </p>
      ),
      tint: "#ecfdf5",
      btnBg: "rgba(22,163,74,0.14)",
      btnColor: "#15803d",
      iconColor: "#16a34a",
    },
    {
      icon: AlertCircle,
      title: "Риски ухода",
      body: (
        <p className="text-sm leading-5" style={{ color: "var(--on-dark-soft)" }}>
          {churnCount} {churnCount === 1 ? "клиент имеет" : "клиента имеют"} высокий риск ухода.
        </p>
      ),
      tint: "#f5f3ff",
      btnBg: "#ede9fe",
      btnColor: "#7c3aed",
      iconColor: "#8b5cf6",
    },
    {
      icon: Clock,
      title: "Загруженность",
      body: (
        <>
          <p className="text-sm leading-5 mb-1" style={{ color: "var(--on-dark-soft)" }}>Наиболее загруженное время в зале</p>
          <p className="text-lg font-medium" style={{ color: "var(--on-dark)" }}>18:00 – 21:00</p>
        </>
      ),
      tint: "var(--card-2)",
      btnBg: "var(--border)",
      btnColor: "var(--on-dark-soft)",
      iconColor: "var(--on-dark-soft)",
    },
    {
      icon: PackageX,
      title: "Потенциальная потеря",
      body: (
        <>
          <p className="text-sm leading-5 mb-1" style={{ color: "var(--on-dark-soft)" }}>{expiringCount} абонементов истекают</p>
          <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
            Потенциальная потеря:<br />
            <span className="text-base font-medium" style={{ color: "var(--on-dark)" }}>{fmt(potentialLoss)} сум</span>
          </p>
        </>
      ),
      tint: "var(--card)",
      btnBg: "var(--card-2)",
      btnColor: "var(--on-dark-soft)",
      iconColor: "var(--on-dark-soft)",
    },
  ]

  return (
    <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "var(--on-dark)" }}>Аналитика клуба</span>
          <HelpCircle className="w-4 h-4" style={{ color: "var(--gray-muted)" }} />
        </div>
        <button
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium"
          style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
        >
          <Calendar className="w-4 h-4" />
          За 7 дней
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {cards.map(({ icon: Icon, title, body, tint, btnBg, btnColor, iconColor }) => (
          <div
            key={title}
            className="rounded-2xl p-8 flex flex-col h-[268px]"
            style={{ background: tint, border: tint === "var(--card)" ? "1px solid var(--border)" : "none" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
              style={{ background: "var(--card)", border: "1px solid rgba(2,6,23,0.06)" }}
            >
              <Icon className="w-6 h-6" style={{ color: iconColor }} />
            </div>
            <span className="text-lg font-medium mb-2" style={{ color: "var(--on-dark)" }}>{title}</span>
            <div className="flex-1">{body}</div>
            <button
              className="h-9 px-4 rounded-md text-sm font-medium self-start mt-4"
              style={{ background: btnBg, color: btnColor }}
            >
              Подробнее
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
