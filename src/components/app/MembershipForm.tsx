"use client"

import { useActionState, useEffect, useRef } from "react"
import { createMembershipAction, type MembershipFormState } from "@/app/(app)/memberships/actions"
import { Input } from "@/components/ui/input"

export function MembershipForm() {
  const [state, formAction, pending] = useActionState<MembershipFormState, FormData>(
    createMembershipAction,
    {},
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-xl" style={{ color: "var(--on-dark)" }}>Новый абонемент</h3>

      <Input name="name" placeholder="Название (напр. «Безлимит 1 мес»)" required />
      <Input name="price" type="number" min="0" step="1000" placeholder="Цена, сум" required />
      <Input name="duration_days" type="number" min="1" placeholder="Срок, дней (30)" required />
      <Input name="visits_limit" type="number" min="1" placeholder="Лимит визитов (пусто = безлимит)" />

      {state.error && <p className="text-sm" style={{ color: "#f87171" }}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
      >
        {pending ? "Добавляем…" : "Добавить абонемент"}
      </button>
    </form>
  )
}
