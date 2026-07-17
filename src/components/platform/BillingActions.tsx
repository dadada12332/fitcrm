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
        style={{ background: "color-mix(in srgb, var(--chart-2) 15%, transparent)", color: "var(--chart-2)", border: "1px solid color-mix(in srgb, var(--chart-2) 30%, transparent)" }}
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Подтвердить
      </button>
      <button
        disabled={pending}
        onClick={() => start(async () => { await runAction(() => rejectBillingRequest(id), { success: "Заявка отклонена", onSuccess: () => router.refresh() }) })}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium disabled:opacity-50"
        style={{ background: "color-mix(in srgb, var(--destructive) 10%, transparent)", color: "var(--destructive)", border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)" }}
      >
        <X className="w-3.5 h-3.5" />
        Отклонить
      </button>
    </div>
  )
}
