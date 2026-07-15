import Link from "next/link"
import type { PaymentRow } from "@/lib/payments"

const PROVIDER_LABEL: Record<string, string> = {
  cash: "Нал", click: "Click", payme: "Payme", uzum: "Uzum",
}

const AVATAR_COLORS = [
  "#6366f1", "#3b82f6", "#f59e0b", "#10b981",
  "#8b5cf6", "#f43f5e", "#14b8a6", "#fb923c",
]

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return "только что"
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h} ч`
  return `${Math.floor(h / 24)} дн`
}

export function RecentPayments({ payments }: { payments: PaymentRow[] }) {
  const list = payments.slice(0, 7)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-[15px] font-semibold" style={{ color: "var(--on-dark)" }}>Последние оплаты</p>
        <Link href="/payments" className="text-xs font-medium hover:underline" style={{ color: "#2563eb" }}>
          Все →
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Нет платежей</p>
          <Link href="/payments" className="text-xs font-medium hover:underline" style={{ color: "#2563eb" }}>
            Создать первую оплату
          </Link>
        </div>
      ) : (
        <div className="flex flex-col">
          {list.map((p, i) => {
            const name = p.clientName ?? "Клиент"
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const row = (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: color }}>
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.provider && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
                        {PROVIDER_LABEL[p.provider] ?? p.provider}
                      </span>
                    )}
                    <span className="text-[11px]" style={{ color: "var(--gray-muted)" }}>{timeAgo(p.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--on-dark)" }}>
                  {p.amount.toLocaleString("ru-RU")} <span className="font-normal text-xs" style={{ color: "var(--gray-muted)" }}>сум</span>
                </p>
              </div>
            )

            return p.clientId
              ? <Link href={`/clients/${p.clientId}`} key={p.id}>{row}</Link>
              : <div key={p.id}>{row}</div>
          })}
        </div>
      )}
    </div>
  )
}
