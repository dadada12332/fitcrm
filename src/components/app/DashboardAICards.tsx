import Link from "next/link"
import { ArrowRight } from "lucide-react"

type Severity = "ok" | "warn" | "alert"

type InsightCard = {
  severity: Severity
  title: string
  body: string
  href: string
  linkLabel: string
}

const META: Record<Severity, { dot: string; bg: string; border: string; label: string }> = {
  ok:    { dot: "#16a34a", bg: "rgba(22,163,74,0.05)",  border: "rgba(22,163,74,0.15)",  label: "Хорошо"    },
  warn:  { dot: "#d97706", bg: "rgba(217,119,6,0.05)",  border: "rgba(217,119,6,0.18)",  label: "Внимание"  },
  alert: { dot: "#dc2626", bg: "rgba(220,38,38,0.05)",  border: "rgba(220,38,38,0.18)",  label: "Важно"     },
}

function buildInsights(
  attendanceChangePct: number,
  expiringCount: number,
  churnCount: number,
  todayRevenue: number,
  prevRevenue: number,
  canViewFinance: boolean,
): InsightCard[] {
  const cards: InsightCard[] = []

  // Revenue
  const revDelta = prevRevenue ? ((todayRevenue - prevRevenue) / prevRevenue) * 100 : 0
  if (canViewFinance && (Math.abs(revDelta) >= 5 || (todayRevenue === 0 && prevRevenue > 0))) {
    cards.push({
      severity: revDelta >= 0 ? "ok" : "alert",
      title: revDelta >= 0
        ? `Выручка выше вчерашней на ${revDelta.toFixed(0)}%`
        : `Выручка ниже вчерашней на ${Math.abs(revDelta).toFixed(0)}%`,
      body: revDelta >= 0
        ? "Хороший день. Продолжайте в том же темпе."
        : "Рассмотрите акцию или напоминание для клиентов.",
      href: "/payments",
      linkLabel: "К оплатам",
    })
  }

  // Expiring memberships
  if (expiringCount > 0) {
    cards.push({
      severity: expiringCount > 5 ? "alert" : "warn",
      title: `Через 7 дней заканчиваются ${expiringCount} абонементов`,
      body: "Самое время предложить продление. Одно напоминание — до 30% конверсия.",
      href: "/clients",
      linkLabel: "Продлить абонементы",
    })
  } else {
    cards.push({
      severity: "ok",
      title: "Истекающих абонементов нет",
      body: "Все активные клиенты обеспечены на ближайшие 7 дней.",
      href: "/clients",
      linkLabel: "К клиентам",
    })
  }

  // Attendance
  if (attendanceChangePct >= 10) {
    cards.push({
      severity: "ok",
      title: `Посещаемость +${attendanceChangePct.toFixed(0)}% к прошлой неделе`,
      body: "Клуб активно посещают. Хороший момент для запуска новых программ.",
      href: "/visits",
      linkLabel: "Посещения",
    })
  } else if (attendanceChangePct <= -10) {
    cards.push({
      severity: "warn",
      title: `Посещаемость упала на ${Math.abs(attendanceChangePct).toFixed(0)}%`,
      body: `${churnCount > 0 ? `${churnCount} клиентов не были более 30 дней.` : "Свяжитесь с клиентами, которые давно не заходили."}`,
      href: "/visits",
      linkLabel: "Посмотреть отчёт",
    })
  } else {
    cards.push({
      severity: "ok",
      title: "Посещаемость стабильна",
      body: "Количество визитов за неделю держится на прежнем уровне.",
      href: "/visits",
      linkLabel: "Посещения",
    })
  }

  return cards
}

type Props = {
  attendanceChangePct: number
  expiringCount: number
  churnCount: number
  todayRevenue: number
  prevRevenue: number
  canViewFinance?: boolean
}

export function DashboardAICards({ attendanceChangePct, expiringCount, churnCount, todayRevenue, prevRevenue, canViewFinance = true }: Props) {
  const insights = buildInsights(attendanceChangePct, expiringCount, churnCount, todayRevenue, prevRevenue, canViewFinance)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 15, lineHeight: 1 }}>✦</span>
          <style>{`
            .ai-gradient-text {
              background: linear-gradient(135deg,#6366f1,#a855f7,#ec4899);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
          `}</style>
          <span className="text-[15px] font-semibold ai-gradient-text">AI Аналитика</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#a855f7" }} />
          <span className="text-xs" style={{ color: "var(--gray-muted)" }}>авто</span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {insights.map((ins, i) => {
          const m = META[ins.severity]
          return (
            <div key={i} className="rounded-lg p-3.5" style={{ background: m.bg, border: `1px solid ${m.border}` }}>
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: m.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--on-dark)" }}>{ins.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{ins.body}</p>
                  <Link
                    href={ins.href}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: m.dot }}
                  >
                    {ins.linkLabel}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
