"use client"

import { useActionState } from "react"
import { createClubAction, type OnboardingState } from "./actions"
import { Input } from "@/components/ui/input"

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createClubAction,
    {},
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>
          Название клуба
        </label>
        <Input name="name" placeholder="PowerGym" required autoFocus />
      </div>
      <div>
        <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--on-dark-soft)" }}>
          Город
        </label>
        <Input name="city" placeholder="Ташкент" />
      </div>

      {state.error && <p className="text-sm" style={{ color: "#f87171" }}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
      >
        {pending ? "Создаём…" : "Создать клуб"}
      </button>
    </form>
  )
}
