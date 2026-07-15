import Link from "next/link"
import type { NewClient } from "@/lib/dashboard"

const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook:  "Facebook",
  referral:  "Рекомендация",
  outdoor:   "Реклама",
  other:     "Другое",
}

const AVATAR_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c",
]

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d === 1)  return "вчера"
  if (d < 7)    return `${d} дн назад`
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
}

export function DashboardNewClients({ clients }: { clients: NewClient[] }) {
  if (clients.length === 0) return null

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[15px] font-semibold" style={{ color: "var(--on-dark)" }}>Новые клиенты</p>
        <Link href="/clients" className="text-xs font-medium hover:underline" style={{ color: "#2563eb" }}>
          Все →
        </Link>
      </div>
      <div className="flex flex-col">
        {clients.map((c, i) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
              {initials(c.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{c.full_name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--gray-muted)" }}>
                {c.source ? SOURCE_LABEL[c.source] ?? c.source : "Без источника"}
              </p>
            </div>
            <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gray-muted)" }}>
              {timeAgo(c.created_at)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
