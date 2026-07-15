"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Loader2 } from "lucide-react"
import { approveBillingRequest, rejectBillingRequest } from "@/app/platform/(protected)/subscriptions/actions"
import { runAction } from "@/lib/use-action"

export function BillingActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => start(async () => { await runAction(() => approveBillingRequest(id), { success: "Оплата подтверждена", onSuccess: () => router.refresh() }) })}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium disabled:opacity-50"
        style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Подтвердить
      </button>
      <button
        disabled={pending}
        onClick={() => start(async () => { await runAction(() => rejectBillingRequest(id), { success: "Заявка отклонена", onSuccess: () => router.refresh() }) })}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium disabled:opacity-50"
        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        <X className="w-3.5 h-3.5" />
        Отклонить
      </button>
    </div>
  )
}
