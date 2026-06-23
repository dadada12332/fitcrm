"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X, Clock, MapPin, User, Users, Wallet, Check, CalendarClock } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { fillColor, type ClassItem } from "@/lib/schedule"
import {
  addClientToClassAction, markAttendanceAction, cancelClassAction, rescheduleClassAction,
} from "@/app/(app)/schedule/actions"

type ClientOpt = { id: string; name: string }

function fmtSum(n: number) { return `${n.toLocaleString("ru-RU")} сум` }

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#94a3b8" }} />
      <span className="text-sm flex-1" style={{ color: "#64748b" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "#020617" }}>{value}</span>
    </div>
  )
}

export function ClassDrawer({ cls, clients, onClose }: { cls: ClassItem | null; clients: ClientOpt[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pickClient, setPickClient] = useState("")
  const [showResched, setShowResched] = useState(false)
  const [rDate, setRDate] = useState(cls?.date ?? "")
  const [rStart, setRStart] = useState(cls?.startTime ?? "")
  const [rEnd, setREnd] = useState(cls?.endTime ?? "")

  const open = cls !== null

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, close = false) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (res.error) { setError(res.error); return }
      router.refresh()
      if (close) onClose()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent>
        {cls && (() => {
          const c = fillColor(cls.fill, cls.status)
          return (
            <div className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>{cls.title}</SheetTitle>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
                    {cls.status === "cancelled" ? "Отменено" : `${cls.seatsBooked}/${cls.seatsTotal}`}
                  </span>
                </div>
                <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors" style={{ color: "#64748b" }}>
                  <X className="w-4 h-4" />
                </SheetClose>
              </SheetHeader>

              <SheetBody>
                <div className="flex flex-col">
                  <Info icon={User} label="Тренер" value={cls.trainerName} />
                  <Info icon={Clock} label="Время" value={`${cls.startTime}–${cls.endTime}`} />
                  <Info icon={MapPin} label="Зал" value={cls.roomName} />
                  <Info icon={Users} label="Записано" value={`${cls.seatsBooked} из ${cls.seatsTotal}`} />
                  <Info icon={Wallet} label="Доход" value={fmtSum(cls.income)} />
                </div>

                {error && <p className="text-sm mt-2" style={{ color: "#dc2626" }}>{error}</p>}

                {/* Список клиентов */}
                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Записанные клиенты</p>
                  {cls.bookings.length === 0 ? (
                    <p className="text-sm py-2" style={{ color: "#94a3b8" }}>Пока никто не записан</p>
                  ) : (
                    <div className="flex flex-col">
                      {cls.bookings.map((b) => (
                        <div key={b.bookingId} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span className="text-sm flex-1" style={{ color: "#334155" }}>{b.name}</span>
                          {b.attended ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>Пришёл</span>
                          ) : (
                            <button disabled={pending} onClick={() => run(() => markAttendanceAction(b.bookingId))}
                              className="text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 hover:bg-slate-100 disabled:opacity-50" style={{ color: "#2563eb" }}>
                              <Check className="w-3.5 h-3.5" />Отметить
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Добавить клиента */}
                {cls.status !== "cancelled" && (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Добавить клиента</p>
                    <div className="flex items-center gap-2">
                      <select value={pickClient} onChange={(e) => setPickClient(e.target.value)}
                        className="h-10 flex-1 rounded-md px-3 text-sm outline-none" style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }}>
                        <option value="">Выберите клиента</option>
                        {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                      </select>
                      <button disabled={pending || !pickClient}
                        onClick={() => run(() => addClientToClassAction(cls.id, pickClient))}
                        className="h-10 px-4 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: "#0f172a" }}>
                        Записать
                      </button>
                    </div>
                  </div>
                )}

                {/* Перенести */}
                {showResched && (
                  <div className="mt-4 rounded-lg p-3 flex flex-col gap-2" style={{ border: "1px solid #e2e8f0" }}>
                    <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={rStart} onChange={(e) => setRStart(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }} />
                      <input type="time" value={rEnd} onChange={(e) => setREnd(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "white", border: "1px solid #e2e8f0", color: "#020617" }} />
                    </div>
                    <button disabled={pending} onClick={() => run(() => rescheduleClassAction(cls.id, rDate, rStart, rEnd), true)}
                      className="h-10 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: "#2563eb" }}>
                      Подтвердить перенос
                    </button>
                  </div>
                )}
              </SheetBody>

              <SheetFooter>
                <button onClick={() => setShowResched((s) => !s)} disabled={pending || cls.status === "cancelled"}
                  className="flex-1 h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50" style={{ background: "white", border: "1px solid #e2e8f0", color: "#334155" }}>
                  <CalendarClock className="w-4 h-4" />Перенести
                </button>
                <button onClick={() => run(() => cancelClassAction(cls.id), true)} disabled={pending || cls.status === "cancelled"}
                  className="flex-1 h-11 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50" style={{ background: "white", border: "1px solid #fecaca", color: "#dc2626" }}>
                  Отменить занятие
                </button>
              </SheetFooter>
            </div>
          )
        })()}
      </SheetContent>
    </Sheet>
  )
}
