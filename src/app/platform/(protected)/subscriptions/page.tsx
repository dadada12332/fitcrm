import Link from "next/link"
import { CreditCard, Inbox } from "lucide-react"
import { getBillingRequests, platformBase, PLAN_LABELS } from "@/lib/platform"
import { Panel, PageHeader, PlanBadge, fmtSum, timeAgo, PT } from "@/components/platform/parts"
import { BillingActions } from "@/components/platform/BillingActions"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  approved: { label: "Подтверждено", color: "#4ade80" },
  rejected: { label: "Отклонено", color: "#f87171" },
  cancelled: { label: "Отменено", color: "#94a3b8" },
}

export default async function SubscriptionsPage() {
  const [{ pending, recent }, base] = await Promise.all([getBillingRequests(), platformBase()])

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Подписки" subtitle="Заявки клубов на оформление и продление тарифов" />

      {/* Pending */}
      <Panel className="overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <Inbox className="w-4 h-4" style={{ color: "#fbbf24" }} />
          <span className="text-sm font-semibold text-white">Ожидают подтверждения</span>
          {pending.length > 0 && (
            <span className="text-[11px] font-semibold px-1.5 h-5 min-w-5 flex items-center justify-center rounded-full" style={{ background: "#f59e0b", color: "#0b1120" }}>
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <CreditCard className="w-8 h-8" style={{ color: PT.textMuted }} />
            <p className="text-sm" style={{ color: PT.textMuted }}>Новых заявок нет</p>
          </div>
        ) : (
          <div className="p-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-2.5 py-3 rounded-lg" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`${base}/clubs/${r.clubId}`} className="text-sm font-medium text-white hover:text-indigo-300 truncate">{r.clubName}</Link>
                    <PlanBadge plan={r.plan} />
                    <span className="text-xs" style={{ color: PT.textMuted }}>· {r.months} мес</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: PT.textMuted }}>
                    {r.requestedEmail ?? "—"} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums" style={{ color: "#4ade80" }}>{r.amount != null ? fmtSum(r.amount) : "—"}</span>
                <BillingActions id={r.id} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Recent */}
      <Panel className="overflow-hidden">
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <span className="text-sm font-semibold text-white">История</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: PT.textMuted }}>Пока пусто</p>
        ) : (
          <div className="p-2">
            {recent.map((r) => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, color: PT.textMuted }
              return (
                <div key={r.id} className="flex items-center gap-3 px-2.5 py-2.5" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                  <Link href={`${base}/clubs/${r.clubId}`} className="text-sm text-white hover:text-indigo-300 truncate flex-1 min-w-0">{r.clubName}</Link>
                  <span className="text-xs" style={{ color: PT.textSoft }}>{PLAN_LABELS[r.plan] ?? r.plan} · {r.months} мес</span>
                  <span className="text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                  <span className="text-[11px]" style={{ color: PT.textMuted }}>{timeAgo(r.resolvedAt ?? r.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
