import Link from "next/link"
import type { PaymentRow } from "@/lib/payments"

const STATUS: Record<string, { dot: string; label: string }> = {
  paid:     { dot: "#16a34a", label: "Оплачено" },
  pending:  { dot: "#f59e0b", label: "Ожидает" },
  refunded: { dot: "#dc2626", label: "Возврат" },
  failed:   { dot: "var(--gray-muted)", label: "Отменён" },
}

const AVATAR_COLORS = [
  "#6366f1", "#3b82f6", "#f59e0b", "#10b981",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c",
]

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
  if (d < 7) return `${d} дн назад`
  return "На прошлой неделе"
}

export function RecentPayments({ payments }: { payments: PaymentRow[] }) {
  const list = payments.slice(0, 6)

  return (
    <div className="rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="font-semibold text-[15px] text-zinc-950 dark:text-zinc-50">
          Последние оплаты
        </span>
        <Link href="/payments" className="text-xs text-blue-600 dark:text-blue-400 transition-colors hover:underline">
          Все →
        </Link>
      </div>

      {/* Payment rows */}
      {list.length === 0 ? (
        <p className="text-sm text-center py-8 pb-5 text-zinc-400 dark:text-zinc-500">
          Нет платежей
        </p>
      ) : (
        <div className="flex flex-col pb-2">
          {list.map((p, i) => {
            const s = STATUS[p.status] ?? STATUS.failed
            const name = p.clientName ?? "Клиент"
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: color }}>
                  {initials(name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-zinc-950 dark:text-zinc-50">{name}</p>
                  <p className="text-xs truncate text-zinc-400 dark:text-zinc-500">{timeAgo(p.createdAt)}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} title={s.label} />
                  <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                    {p.amount.toLocaleString("ru-RU")}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
