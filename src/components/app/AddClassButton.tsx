"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "@/lib/use-action"
import { Plus, X } from "lucide-react"
import { createClassAction, type ClassFormState } from "@/app/(app)/schedule/actions"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import type { Room } from "@/lib/schedule"
import { MoneyInput } from "./MoneyInput"

const inputCls = "h-11 w-full rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb]"
const inputStyle = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" } as const

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--on-dark-soft)" }}>{children}<span style={{ color: "#dc2626" }}> *</span></label>
}

export function AddClassButton({ rooms, defaultDate, trainers = [] }: { rooms: Room[]; defaultDate: string; trainers?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(createClassAction, {})

  // Reflect the completed Server Action in the drawer state.
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      toast.success("Занятие создано")
    }
    else if (state.error) toast.error(state.error)
  }, [state])

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--on-dark)", color: "var(--bg)" }}>
        <Plus className="w-4 h-4" />Добавить занятие
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form action={formAction} className="flex flex-col h-full">
            <SheetHeader>
              <SheetTitle>Новое занятие</SheetTitle>
              <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
                <X className="w-4 h-4" />
              </SheetClose>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-4">
                <div><Label>Название</Label><input name="title" autoFocus placeholder="Йога" className={inputCls} style={inputStyle} /></div>
                <div>
                  <Label>Тренер</Label>
                  <select name="trainer_name" defaultValue="" className={inputCls} style={inputStyle}>
                    <option value="">Без тренера</option>
                    {trainers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Зал</Label>
                  <select name="room_id" defaultValue="" className={inputCls} style={inputStyle}>
                    <option value="">Без зала</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div><Label>Дата</Label><input name="date" type="date" defaultValue={defaultDate} className={inputCls} style={inputStyle} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Начало</Label><input name="start_time" type="time" defaultValue="08:00" className={inputCls} style={inputStyle} /></div>
                  <div><Label>Конец</Label><input name="end_time" type="time" defaultValue="09:00" className={inputCls} style={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Мест</Label><input name="seats_total" type="number" min="1" defaultValue={15} className={inputCls} style={inputStyle} /></div>
                  <div><Label>Цена</Label><MoneyInput name="price" defaultValue={0} className={inputCls} style={inputStyle} /></div>
                </div>
                {state.error && <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>}
              </div>
            </SheetBody>

            <SheetFooter>
              <button type="submit" disabled={pending}
                className="flex-1 h-11 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ background: "var(--on-dark)" }}>
                {pending ? "Сохранение…" : "Создать занятие"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
