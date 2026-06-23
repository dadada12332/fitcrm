"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { createClientAction, type ClientFormState } from "@/app/(app)/clients/actions"
import { Input } from "@/components/ui/input"

export function AddClientButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(createClientAction, {})

  useEffect(() => {
    if (state.ok) {
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "#0f172a", color: "#f8fafc" }}
      >
        <Plus className="w-4 h-4" />
        Добавить клиента
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(2,6,23,0.4)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-medium" style={{ color: "#020617" }}>Новый клиент</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100" style={{ color: "#64748b" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <Field label="ФИО"><Input name="full_name" placeholder="Иван Иванов" required autoFocus /></Field>
              <Field label="Телефон"><Input name="phone" placeholder="+998 90 123-45-67" /></Field>
              <Field label="Теги"><Input name="tags" placeholder="VIP, новый (через запятую)" /></Field>
              <Field label="Заметка"><Input name="notes" placeholder="Комментарий" /></Field>

              {state.error && <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="h-10 px-4 rounded-md text-sm font-medium" style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}>
                  Отмена
                </button>
                <button type="submit" disabled={pending}
                  className="h-10 px-5 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ background: "#0f172a" }}>
                  {pending ? "Сохранение…" : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-2" style={{ color: "#64748b" }}>{label}</label>
      {children}
    </div>
  )
}
