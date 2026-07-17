"use client"

import { useState, useTransition } from "react"
import { DoorOpen, Plus, Trash2, X } from "lucide-react"
import { runAction } from "@/lib/use-action"
import { createRoomAction, deleteRoomAction } from "@/app/(app)/schedule/actions"
import type { Room } from "@/lib/schedule"

export function RoomsManager({ rooms }: { rooms: Room[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [cap, setCap] = useState("")
  const [pending, start] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const add = () => {
    const nm = name.trim()
    if (!nm) return
    start(async () => {
      await runAction(() => createRoomAction(nm, cap ? Number(cap) : undefined), {
        loading: "Добавляем зал…", success: "Зал добавлен",
        onSuccess: () => { setName(""); setCap("") },
      })
    })
  }

  const del = (id: string) => {
    start(async () => {
      await runAction(() => deleteRoomAction(id), {
        loading: "Удаляем зал…", success: "Зал удалён",
        onSuccess: () => { setConfirmId(null) },
      })
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-1.5"
        style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
        <DoorOpen className="w-4 h-4" /> Залы
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Управление залами</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--gray-muted)" }} /></button>
            </div>

            <div className="flex flex-col gap-2 mb-4 max-h-[300px] overflow-y-auto">
              {rooms.length === 0 && <p className="text-sm py-2" style={{ color: "var(--on-dark-soft)" }}>Залов пока нет — добавьте первый ниже.</p>}
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: "var(--card-2)" }}>
                  <span className="text-sm" style={{ color: "var(--on-dark)" }}>{r.name}</span>
                  {confirmId === r.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--gray-muted)" }}>Удалить вместе с занятиями?</span>
                      <button disabled={pending} onClick={() => del(r.id)} className="text-xs font-medium" style={{ color: "#dc2626" }}>Да</button>
                      <button onClick={() => setConfirmId(null)} className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Нет</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(r.id)} className="p-1 rounded hover:bg-black/5"><Trash2 className="w-4 h-4" style={{ color: "var(--gray-muted)" }} /></button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add() }}
                placeholder="Название зала" className="flex-1 h-9 rounded-md px-3 text-sm outline-none"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
              <input value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))}
                placeholder="Мест" className="w-16 h-9 rounded-md px-2 text-sm outline-none text-center"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
              <button disabled={pending || !name.trim()} onClick={add}
                className="h-9 px-3 rounded-md text-sm font-medium flex items-center gap-1 text-white"
                style={{ background: "#0065fc", opacity: pending || !name.trim() ? 0.6 : 1 }}>
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
