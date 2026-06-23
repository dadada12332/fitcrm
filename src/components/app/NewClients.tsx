import Link from "next/link"
import type { NewClient } from "@/lib/dashboard"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} дн назад`
}

const avatarColors = ["#fbbf24", "#f472b6", "#34d399", "#60a5fa", "#a78bfa", "#fb923c"]

export function NewClients({ clients }: { clients: NewClient[] }) {
  return (
    <div className="rounded-lg p-6 flex flex-col h-full" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <span className="text-xl font-medium tracking-[-0.12px]" style={{ color: "#020617" }}>Новые клиенты</span>
        <Link
          href="/clients"
          className="h-8 px-3 rounded-md text-xs font-medium flex items-center"
          style={{ background: "white", color: "#020617", border: "1px solid #e2e8f0" }}
        >
          Показать все
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "#94a3b8" }}>
          Пока нет клиентов
        </p>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {clients.map((c, i) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3 -mx-2 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: avatarColors[i % avatarColors.length] }}
              >
                {initials(c.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#020617" }}>{c.full_name}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{timeAgo(c.created_at)}</p>
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: "#64748b" }}>
                {c.membership ?? "Без абонемента"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
