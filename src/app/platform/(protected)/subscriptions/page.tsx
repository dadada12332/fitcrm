import Link from "next/link"
import { CreditCard, Inbox } from "lucide-react"
import { getBillingRequests, platformBase, PLAN_LABELS } from "@/lib/platform"
import { Panel, PageHeader, PlanBadge, fmtSum, timeAgo, PT } from "@/components/platform/parts"
import { BillingActions } from "@/components/platform/BillingActions"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  approved: { label: "Подтверждено", color: "var(--chart-2)" },
  rejected: { label: "Отклонено", color: "var(--destructive)" },
  cancelled: { label: "Отменено", color: "var(--muted-foreground)" },
}

export default async function SubscriptionsPage() {
  const [{ pending, recent }, base] = await Promise.all([getBillingRequests(), platformBase()])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Подписки" subtitle="Заявки клубов на оформление и продление тарифов" />

      {/* Pending */}
      <Panel className="overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <Inbox className="w-4 h-4" style={{ color: "var(--chart-3)" }} />
          <span className="text-sm font-semibold text-foreground">Ожидают подтверждения</span>
          {pending.length > 0 && (
            <span className="text-[11px] font-semibold px-1.5 h-5 min-w-5 flex items-center justify-center rounded-full" style={{ background: "var(--chart-3)", color: "var(--background)" }}>
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
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg px-2.5 py-3" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`${base}/clubs/${r.clubId}`} className="text-sm font-medium text-foreground hover:text-brand truncate">{r.clubName}</Link>
                    <PlanBadge plan={r.plan} />
                    <span className="text-xs" style={{ color: PT.textMuted }}>· {r.months} мес</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: PT.textMuted }}>
                    {r.requestedEmail ?? "—"} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--chart-2)" }}>{r.amount != null ? fmtSum(r.amount) : "—"}</span>
                  <BillingActions id={r.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Recent */}
      <Panel className="overflow-hidden">
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <span className="text-sm font-semibold text-foreground">История</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: PT.textMuted }}>Пока пусто</p>
        ) : (
          <div className="p-2">
            {recent.map((r) => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, color: PT.textMuted }
              return (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2.5 py-2.5 sm:flex sm:items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                  <Link href={`${base}/clubs/${r.clubId}`} className="min-w-0 truncate text-sm text-foreground hover:text-brand sm:flex-1">{r.clubName}</Link>
                  <span className="text-xs font-medium sm:order-3" style={{ color: st.color }}>{st.label}</span>
                  <span className="truncate text-xs sm:order-2" style={{ color: PT.textSoft }}>{PLAN_LABELS[r.plan] ?? r.plan} · {r.months} мес</span>
                  <span className="text-right text-[11px] sm:order-4" style={{ color: PT.textMuted }}>{timeAgo(r.resolvedAt ?? r.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
