"use client"

import { useActionState, useEffect, useRef } from "react"
import { createClientAction, type ClientFormState } from "@/app/(app)/clients/actions"
import { Input } from "@/components/ui/input"

export function ClientForm() {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientAction,
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
      className="rounded-lg p-6 flex flex-col gap-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-xl" style={{ color: "var(--on-dark)" }}>Новый клиент</h3>

      <Input name="full_name" placeholder="ФИО" required />
      <Input name="phone" placeholder="Телефон (+998…)" />
      <Input name="tags" placeholder="Теги через запятую" />
      <Input name="notes" placeholder="Заметка" />

      {state.error && <p className="text-sm" style={{ color: "#f87171" }}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl text-sm font-semibold uppercase tracking-wider text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--orange)", fontFamily: "var(--font-display)" }}
      >
        {pending ? "Добавляем…" : "Добавить клиента"}
      </button>
    </form>
  )
}
