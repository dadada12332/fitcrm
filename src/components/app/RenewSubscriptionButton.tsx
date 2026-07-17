"use client"

import { useState, useTransition } from "react"
import { X, RefreshCw, Check, ChevronDown, CalendarClock } from "lucide-react"
import { renewSubscriptionAction } from "@/app/(app)/clients/actions"
import type { CurrentSubscription } from "@/lib/client-profile"
import { toast } from "@/lib/use-action"

type Membership = { id: string; name: string; price: number }

const fmt = (n: number) => n.toLocaleString("ru-RU")
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU") : "—")

export function RenewSubscriptionButton({ clientId, clientName, subscription, memberships }: {
  clientId: string
  clientName: string
  subscription: CurrentSubscription | null
  memberships: Membership[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const options: Membership[] = [{ id: "single", name: "Разовый (1 занятие)", price: 0 }, ...memberships]
  // По умолчанию — текущий абонемент (сопоставляем по названию), иначе первый.
  const currentId = memberships.find((m) => m.name === subscription?.name)?.id ?? ""
  const [membershipId, setMembershipId] = useState(currentId)

  const isExtend = !!currentId && membershipId === currentId
  const selected = options.find((o) => o.id === membershipId)

  function submit() {
    if (!membershipId) { setError("Выберите абонемент"); return }
    setError(null)
    start(async () => {
      const res = await renewSubscriptionAction(clientId, membershipId)
      if (res.error) { setError(res.error); toast.error(res.error); return }
      setOpen(false)
      toast.success(isExtend ? "Абонемент продлён" : "Абонемент оформлен")
    })
  }

  return (
    <>
      <button onClick={() => { setMembershipId(currentId); setError(null); setOpen(true) }}
        className="w-full h-11 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{ background: "#16a34a" }}>
        <RefreshCw className="w-4 h-4" /> Продлить абонемент
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex justify-end" onClick={() => setOpen(false)} style={{ background: "rgba(2,6,23,0.4)" }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full flex flex-col" style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>Продление абонемента</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{clientName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Текущий абонемент */}
              <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--gray-muted)" }}>Текущий абонемент</p>
                {subscription ? (
                  <>
                    <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{subscription.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--on-dark-soft)" }}>
                      <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> до {fmtDate(subscription.expiresAt)}</span>
                      {subscription.visitsTotal !== null && <span>· {subscription.visitsTotal - subscription.visitsUsed} из {subscription.visitsTotal} посещений</span>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Нет активного абонемента</p>
                )}
              </div>

              {/* Выбор абонемента */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark)" }}>Абонемент</label>
                <div className="relative">
                  <select value={membershipId} onChange={(e) => setMembershipId(e.target.value)}
                    className="w-full h-11 rounded-lg px-3 pr-9 text-sm outline-none appearance-none"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: membershipId ? "var(--on-dark)" : "var(--gray-muted)" }}>
                    <option value="">Выберите абонемент</option>
                    {options.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}{m.price > 0 ? ` — ${fmt(m.price)} сум` : ""}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
                </div>
                {membershipId && (
                  <p className="text-xs mt-2" style={{ color: isExtend ? "#16a34a" : "#d97706" }}>
                    {isExtend
                      ? `Продлить текущий «${selected?.name}» (срок и посещения добавятся)`
                      : `Сменить на «${selected?.name}» — прежний активный абонемент будет закрыт`}
                  </p>
                )}
              </div>

              {error && <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={submit} disabled={pending || !membershipId}
                className="w-full h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#16a34a" }}>
                <Check className="w-4 h-4" /> {pending ? "Оформление…" : isExtend ? "Продлить" : "Оформить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
