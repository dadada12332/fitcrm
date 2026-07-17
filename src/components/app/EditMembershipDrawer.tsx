"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "@/lib/use-action"
import { X } from "lucide-react"
import { updateMembershipAction, type MembershipFormState } from "@/app/(app)/memberships/actions"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { DateField } from "@/components/ui/date-field"
import { inputCls, inputStyle, Label, DurationField, AvailableDays, AvailableTime } from "./membership-fields"
import { membershipStatus, type MembershipRow } from "@/lib/memberships"
import { MoneyInput } from "./MoneyInput"

function isoToMask(iso: string | null): string {
  if (!iso) return ""
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ""
}

export function EditMembershipDrawer({ row, onClose }: { row: MembershipRow; onClose: () => void }) {
  const [freeze, setFreeze] = useState(row.freezeAllowed)
  const [state, formAction, pending] = useActionState<MembershipFormState, FormData>(updateMembershipAction, {})

  useEffect(() => {
    if (state.ok) { toast.success("Абонемент сохранён"); onClose() }
    else if (state.error) toast.error(state.error)
  }, [state, onClose])

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="max-w-[520px]">
        <form action={formAction} className="flex flex-col h-full">
          <input type="hidden" name="id" value={row.id} />
          <SheetHeader>
            <SheetTitle>Редактирование абонемента</SheetTitle>
            <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
              <X className="w-4 h-4" />
            </SheetClose>
          </SheetHeader>

          <SheetBody>
            <div className="flex flex-col gap-4">
              <div>
                <Label required>Название</Label>
                <input name="name" required defaultValue={row.name} placeholder="Введите название" className={inputCls} style={inputStyle} />
              </div>

              <div>
                <Label>Описание</Label>
                <textarea name="description" rows={3} defaultValue={row.description ?? ""} placeholder="Краткое описание абонемента"
                  className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]" style={inputStyle} />
              </div>

              <div style={{ borderTop: "1px solid var(--border)" }} />

              <div>
                <Label required>Срок действия</Label>
                <DateField name="valid_until" defaultValue={isoToMask(row.validUntil)} className={`${inputCls} pr-9`} style={inputStyle} />
              </div>

              {/* Подкарточка: количество дней + заморозка */}
              <div className="rounded-lg p-4 flex flex-col gap-3" style={{ border: "1px solid var(--border)" }}>
                <div>
                  <Label required>Количество дней</Label>
                  <DurationField initialDays={row.durationDays} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={freeze} onCheckedChange={setFreeze} />
                  <input type="hidden" name="freeze_allowed" value={freeze ? "on" : "off"} />
                  <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Можно замораживать</span>
                </label>
              </div>

              <div>
                <Label required>Цена</Label>
                <MoneyInput name="price" required defaultValue={row.price} placeholder="Например 450 000" className={inputCls} style={inputStyle} />
              </div>

              <div>
                <Label required>Доступные дни</Label>
                <AvailableDays initial={row.availableDays} />
              </div>

              <div>
                <Label required>Доступное время</Label>
                <AvailableTime initial={row.availableTime} />
              </div>

              <div>
                <Label required>Статус</Label>
                <select name="status" defaultValue={membershipStatus(row)} className={inputCls} style={inputStyle}>
                  <option value="active">Активный</option>
                  <option value="inactive">Отключён</option>
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
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-md text-sm font-medium transition-colors bg-[var(--card)] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[var(--border)] text-[var(--on-dark-soft)]">
              Отмена
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
