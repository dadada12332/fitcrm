"use client"

import { useState, useMemo, useTransition } from "react"
import { toast } from "@/lib/use-action"
import { useRouter } from "next/navigation"
import { X, Clock, MapPin, User, Users, Wallet, CalendarClock } from "lucide-react"
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
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gray-muted)" }} />
      <span className="text-sm flex-1" style={{ color: "var(--on-dark-soft)" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{value}</span>
    </div>
  )
}

export function ClassDrawer({ cls, clients, onClose }: { cls: ClassItem | null; clients: ClientOpt[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pickClient, setPickClient] = useState("")
  const [clientQuery, setClientQuery] = useState("")
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return []
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, clientQuery])
  const [showResched, setShowResched] = useState(false)
  const [rDate, setRDate] = useState(cls?.date ?? "")
  const [rStart, setRStart] = useState(cls?.startTime ?? "")
  const [rEnd, setREnd] = useState(cls?.endTime ?? "")

  const open = cls !== null

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>, close = false) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (res.error) { setError(res.error); toast.error(res.error); return }
      if (close) toast.success("Сохранено")
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
                <SheetClose className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
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
                  <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--gray-muted)" }}>Записанные клиенты</p>
                  {cls.bookings.length === 0 ? (
                    <p className="text-sm py-2" style={{ color: "var(--gray-muted)" }}>Пока никто не записан</p>
                  ) : (
                    <div className="flex flex-col">
                      {cls.bookings.map((b) => (
                        <div key={b.bookingId} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <span className="text-sm flex-1" style={{ color: "var(--on-dark-soft)" }}>{b.name}</span>
                          {b.attended ? (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(22,163,74,0.14)", color: "#16a34a" }}>Пришёл</span>
                          ) : (
                            <button disabled={pending} onClick={() => run(() => markAttendanceAction(b.bookingId))}
                              className="text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 hover:bg-red-50 disabled:opacity-50" style={{ color: "#dc2626" }}>
                              <X className="w-3.5 h-3.5" />Отметить
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
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--gray-muted)" }}>Добавить клиента</p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input value={clientQuery} onChange={(e) => { setClientQuery(e.target.value); setPickClient("") }}
                          placeholder="Поиск клиента по имени…"
                          className="h-10 w-full rounded-md px-3 text-sm outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
                        {clientQuery.trim() && !pickClient && filteredClients.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 rounded-md overflow-hidden max-h-52 overflow-y-auto" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                            {filteredClients.map((cl) => (
                              <button key={cl.id} onClick={() => { setPickClient(cl.id); setClientQuery(cl.name) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark)" }}>
                                {cl.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button disabled={pending || !pickClient}
                        onClick={() => { run(() => addClientToClassAction(cls.id, pickClient)); setPickClient(""); setClientQuery("") }}
                        className="h-10 px-4 rounded-md text-sm font-medium text-white disabled:opacity-50 shrink-0" style={{ background: "var(--on-dark)" }}>
                        Записать
                      </button>
                    </div>
                  </div>
                )}

                {/* Перенести */}
                {showResched && (
                  <div className="mt-4 rounded-lg p-3 flex flex-col gap-2" style={{ border: "1px solid var(--border)" }}>
                    <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={rStart} onChange={(e) => setRStart(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
                      <input type="time" value={rEnd} onChange={(e) => setREnd(e.target.value)} className="h-10 rounded-md px-3 text-sm outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
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
                  className="flex-1 h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2 bg-[var(--card)] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[var(--border)] text-[var(--on-dark-soft)] disabled:opacity-50">
                  <CalendarClock className="w-4 h-4" />Перенести
                </button>
                <button onClick={() => run(() => cancelClassAction(cls.id), true)} disabled={pending || cls.status === "cancelled"}
                  className="flex-1 h-11 rounded-md text-sm font-medium bg-[var(--card)] hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 disabled:opacity-50">
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
