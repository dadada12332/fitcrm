"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "@/lib/use-action"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Copy, Users, Ban, Power, Archive, ArchiveRestore, Trash2 } from "lucide-react"
import {
  duplicateMembershipAction, setMembershipActiveAction, setMembershipArchivedAction, deleteMembershipAction,
} from "@/app/(app)/memberships/actions"
import { EditMembershipDrawer } from "./EditMembershipDrawer"
import type { MembershipRow } from "@/lib/memberships"

type Result = { ok?: boolean; error?: string }

function Item({ icon: Icon, label, onClick, danger, disabled }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "hover:bg-red-50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
      style={{ color: danger ? "#dc2626" : "var(--on-dark)" }}>
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: danger ? "#dc2626" : "var(--on-dark-soft)" }} />
      {label}
    </button>
  )
}

export function MembershipRowMenu({ row, onDark }: { row: MembershipRow; onDark?: boolean }) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  function close() { setOpen(false); setConfirmDel(false); setError(null) }

  function run(fn: () => Promise<Result>, keepOpen = false) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (res.error) { setError(res.error); toast.error(res.error); return }
      toast.success("Готово")
      if (!keepOpen) close()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer"
        style={onDark
          ? { color: "white", background: "rgba(255,255,255,0.15)" }
          : { color: "var(--gray-muted)" }}
        onMouseEnter={e => { if (onDark) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)" }}
        onMouseLeave={e => { if (onDark) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)" }}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg py-1 shadow-lg"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <Item icon={Pencil} label="Редактировать" disabled={pending} onClick={() => { setEditing(true); close() }} />
          <Item icon={Copy} label="Дублировать" disabled={pending} onClick={() => run(() => duplicateMembershipAction(row.id))} />
          <Item icon={Users} label="Посмотреть клиентов" disabled={pending}
            onClick={() => router.push(`/clients?membership=${encodeURIComponent(row.name)}`)} />

          {row.isActive
            ? <Item icon={Ban} label="Отключить" disabled={pending} onClick={() => run(() => setMembershipActiveAction(row.id, false))} />
            : <Item icon={Power} label="Включить" disabled={pending} onClick={() => run(() => setMembershipActiveAction(row.id, true))} />}

          {row.archived
            ? <Item icon={ArchiveRestore} label="Разархивировать" disabled={pending} onClick={() => run(() => setMembershipArchivedAction(row.id, false))} />
            : <Item icon={Archive} label="Архивировать" disabled={pending} onClick={() => run(() => setMembershipArchivedAction(row.id, true))} />}

          <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />

          {confirmDel ? (
            <div className="px-3 py-2">
              <p className="text-sm mb-2" style={{ color: "var(--on-dark-soft)" }}>Удалить тариф?</p>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => run(() => deleteMembershipAction(row.id))}
                  className="flex-1 h-8 rounded-md text-xs font-medium text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "#dc2626" }}>Да, удалить</button>
                <button type="button" onClick={() => setConfirmDel(false)}
                  className="flex-1 h-8 rounded-md text-xs font-medium cursor-pointer bg-[var(--card)] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-[var(--border)] text-[var(--on-dark-soft)]">Отмена</button>
              </div>
            </div>
          ) : (
            <Item icon={Trash2} label="Удалить" danger disabled={pending} onClick={() => { setConfirmDel(true); setError(null) }} />
          )}

          {error && <p className="px-3 py-2 text-xs" style={{ color: "#dc2626" }}>{error}</p>}
        </div>
      )}

      {editing && <EditMembershipDrawer row={row} onClose={() => setEditing(false)} />}
    </div>
  )
}
