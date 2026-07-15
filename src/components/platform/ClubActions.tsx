"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogIn, CalendarPlus, ArrowUpDown, Ban, CheckCircle2, Loader2, ChevronDown } from "lucide-react"
import { impersonateClub, extendTrial, changePlan, setClubStatus } from "@/app/platform/(protected)/clubs/[id]/actions"
import { PT } from "./parts"
import { fmtMoney } from "@/lib/money"
import { runAction, toast } from "@/lib/use-action"

type PlanOption = { code: string; name: string; price: number; currency: string; is_trial: boolean }

export function ClubActions({ clubId, status, plan, plans }: { clubId: string; status: string; plan: string; plans: PlanOption[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [planOpen, setPlanOpen] = useState(false)
  const suspended = status === "suspended"

  // impersonateClub делает redirect на стороне сервера — тост не нужен
  const run = (fn: () => Promise<unknown>) => () => start(async () => { await fn() })
  const act = (fn: () => Promise<unknown>, success: string) => start(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runAction(fn as any, { success, onSuccess: () => router.refresh() })
  })

  const btn = "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        disabled={pending}
        onClick={run(() => impersonateClub(clubId))}
        className={btn}
        style={{ background: "linear-gradient(135deg,#6366f1,#4338ca)", color: "white" }}
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Войти как владелец
      </button>

      <button
        disabled={pending}
        onClick={() => act(() => extendTrial(clubId, 14), "Trial продлён на 14 дней")}
        className={btn}
        style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.text }}
      >
        <CalendarPlus className="w-4 h-4" style={{ color: "#4ade80" }} />
        Продлить Trial +14д
      </button>

      <div className="relative">
        <button
          disabled={pending}
          onClick={() => setPlanOpen((v) => !v)}
          className={btn}
          style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.text }}
        >
          <ArrowUpDown className="w-4 h-4" style={{ color: "#a78bfa" }} />
          Изменить тариф
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {planOpen && (
          <div className="absolute left-0 top-11 z-20 w-56 rounded-lg py-1 overflow-hidden" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            {plans.length === 0 && <p className="px-3 py-2 text-xs" style={{ color: PT.textMuted }}>Нет активных тарифов</p>}
            {plans.map((p) => (
              <button
                key={p.code}
                onClick={() => { setPlanOpen(false); act(() => changePlan(clubId, p.code), `Тариф изменён: ${p.name}`) }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
                style={{ color: p.code === plan ? "#a5b4fc" : PT.text }}
              >
                <span>{p.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs tabular-nums" style={{ color: PT.textMuted }}>
                    {p.is_trial ? "бесплатно" : fmtMoney(p.price, p.currency)}
                  </span>
                  {p.code === plan && <CheckCircle2 className="w-3.5 h-3.5" />}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {suspended ? (
        <button
          disabled={pending}
          onClick={() => act(() => setClubStatus(clubId, "active"), "Клуб разблокирован")}
          className={btn}
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
        >
          <CheckCircle2 className="w-4 h-4" />
          Разблокировать
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => act(() => setClubStatus(clubId, "suspended"), "Клуб заблокирован")}
          className={btn}
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
        >
          <Ban className="w-4 h-4" />
          Заблокировать
        </button>
      )}
    </div>
  )
}
