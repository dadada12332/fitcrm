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
        <p className="text-sm leading-5" style={{ color: "#64748b" }}>
          За последние 7 дней посещаемость {attendanceChangePct <= 0 ? "снизилась" : "выросла"} на {attendanceDown}%
        </p>
      ),
      tint: "#ecfdf5",
      btnBg: "#dcfce7",
      btnColor: "#15803d",
      iconColor: "#16a34a",
    },
    {
      icon: AlertCircle,
      title: "Риски ухода",
      body: (
        <p className="text-sm leading-5" style={{ color: "#64748b" }}>
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
          <p className="text-sm leading-5 mb-1" style={{ color: "#64748b" }}>Наиболее загруженное время в зале</p>
          <p className="text-lg font-medium" style={{ color: "#020617" }}>18:00 – 21:00</p>
        </>
      ),
      tint: "#f1f5f9",
      btnBg: "#e2e8f0",
      btnColor: "#475569",
      iconColor: "#64748b",
    },
    {
      icon: PackageX,
      title: "Потенциальная потеря",
      body: (
        <>
          <p className="text-sm leading-5 mb-1" style={{ color: "#64748b" }}>{expiringCount} абонементов истекают</p>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Потенциальная потеря:<br />
            <span className="text-base font-medium" style={{ color: "#020617" }}>{fmt(potentialLoss)} сум</span>
          </p>
        </>
      ),
      tint: "#ffffff",
      btnBg: "#f1f5f9",
      btnColor: "#475569",
      iconColor: "#64748b",
    },
  ]

  return (
    <div className="rounded-lg p-6" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "#020617" }}>Аналитика клуба</span>
          <HelpCircle className="w-4 h-4" style={{ color: "#94a3b8" }} />
        </div>
        <button
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium"
          style={{ background: "white", color: "#020617", border: "1px solid #e2e8f0" }}
        >
          <Calendar className="w-4 h-4" />
          За 7 дней
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(({ icon: Icon, title, body, tint, btnBg, btnColor, iconColor }) => (
          <div
            key={title}
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: tint, border: tint === "#ffffff" ? "1px solid #e2e8f0" : "none" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "white", border: "1px solid rgba(2,6,23,0.06)" }}
            >
              <Icon className="w-4 h-4" style={{ color: iconColor }} />
            </div>
            <span className="text-base font-medium" style={{ color: "#020617" }}>{title}</span>
            <div className="flex-1">{body}</div>
            <button
              className="h-8 px-3 rounded-md text-xs font-medium self-start"
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
