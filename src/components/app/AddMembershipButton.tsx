"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "@/lib/use-action"
import { Plus, X } from "lucide-react"
import { createMembershipAction, type MembershipFormState } from "@/app/(app)/memberships/actions"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { DateField } from "@/components/ui/date-field"
import { inputCls, inputStyle, Label, DurationField, AvailableDays, AvailableTime } from "./membership-fields"
import { MoneyInput } from "./MoneyInput"

export function AddMembershipButton() {
  const [open, setOpen] = useState(false)
  const [freeze, setFreeze] = useState(true)
  const [state, formAction, pending] = useActionState<MembershipFormState, FormData>(createMembershipAction, {})

  // Reflect the completed Server Action in the drawer state.
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      toast.success("Абонемент создан")
    } else if (state.error) toast.error(state.error)
  }, [state])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--on-dark)", color: "var(--bg)" }}
      >
        <Plus className="w-4 h-4" />
        Добавить абонемент
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-[520px]">
          <form action={formAction} className="flex flex-col h-full">
            <SheetHeader>
              <SheetTitle>Добавление абонемента</SheetTitle>
              <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
                <X className="w-4 h-4" />
              </SheetClose>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-4">
                <div>
                  <Label required>Название</Label>
                  <input name="name" required autoFocus placeholder="Введите название" className={inputCls} style={inputStyle} />
                </div>

                <div>
                  <Label>Описание</Label>
                  <textarea name="description" rows={3} placeholder="Краткое описание абонемента"
                    className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    style={inputStyle} />
                </div>

                <div style={{ borderTop: "1px solid var(--border)" }} />

                <div>
                  <Label required>Срок действия</Label>
                  <DateField name="valid_until" className={`${inputCls} pr-9`} style={inputStyle} />
                </div>

                {/* Подкарточка: количество дней + заморозка */}
                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ border: "1px solid var(--border)" }}>
                  <div>
                    <Label required>Количество дней</Label>
                    <DurationField />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Switch checked={freeze} onCheckedChange={setFreeze} />
                    <input type="hidden" name="freeze_allowed" value={freeze ? "on" : "off"} />
                    <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Можно замораживать</span>
                  </label>
                </div>

                <div>
                  <Label required>Цена</Label>
                  <MoneyInput name="price" required placeholder="Например 450 000" className={inputCls} style={inputStyle} />
                </div>

                <div>
                  <Label required>Доступные дни</Label>
                  <AvailableDays />
                </div>

                <div>
                  <Label required>Доступное время</Label>
                  <AvailableTime />
                </div>

                <div>
                  <Label required>Статус</Label>
                  <select name="status" defaultValue="active" className={inputCls} style={inputStyle}>
                    <option value="active">Активный</option>
                    <option value="archived">Архив</option>
                  </select>
                </div>

                {state.error && <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>}
              </div>
            </SheetBody>

            <SheetFooter>
              <button type="submit" disabled={pending}
                className="flex-1 h-11 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ background: "var(--on-dark)" }}>
                {pending ? "Сохранение…" : "Сохранить"}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-md text-sm font-medium transition-colors bg-[var(--card)] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[var(--border)] text-[var(--on-dark-soft)]">
                Добавить в черновик
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
