"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Building2, Check, Plus, ChevronsUpDown } from "lucide-react"
import { getBranchesAction, switchBranchAction, type Branch } from "@/app/(app)/actions"

const PLAN_LABELS: Record<string, string> = {
  trial:    "Пробный",
  starter:  "Стартер",
  standard: "Стандарт",
  business: "Бизнес",
}

type Props = {
  clubId: string
  clubName: string
  collapsed?: boolean
}

export function BranchSwitcher({ clubId, clubName, collapsed = false }: Props) {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [open])

  const handleOpen = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (branches.length === 0) {
      setLoading(true)
      const data = await getBranchesAction()
      setBranches(data)
      setLoading(false)
    }
  }

  const handleSwitch = (branch: Branch) => {
    if (branch.clubId === clubId) { setOpen(false); return }
    setOpen(false)
    startTransition(async () => {
      await switchBranchAction(branch.clubId)
      // Полная перезагрузка (не router.refresh): смена клуба обязана сбросить
      // клиентский Router Cache целиком, иначе префетч-страницы прошлого клуба
      // «протекают» в новый (критично для изоляции данных между клубами).
      window.location.assign("/dashboard")
    })
  }

  return (
    <div ref={ref} className="relative">
      {/* Dropdown — appears above the button */}
      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-1 rounded-lg overflow-hidden z-50"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.1)",
          }}
        >
          {/* Branch list */}
          <div className="py-1">
            {loading ? (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--gray-muted)" }}>Загрузка...</div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--gray-muted)" }}>Нет филиалов</div>
            ) : branches.map((b) => {
              const active = b.clubId === clubId
              return (
                <button
                  key={b.clubId}
                  onClick={() => handleSwitch(b)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#f4f4f5] text-left"
                >
                  {/* Club avatar */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center text-white font-semibold"
                    style={{
                      width: 28,
                      height: 28,
                      background: active ? "#2563eb" : "#e4e4e7",
                      borderRadius: 8,
                      fontSize: 12,
                      color: active ? "white" : "#71717a",
                    }}
                  >
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{b.name}</p>
                    {b.plan && (
                      <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>
                        {PLAN_LABELS[b.plan] ?? b.plan}
                      </p>
                    )}
                  </div>
                  {active && <Check style={{ width: 14, height: 14, color: "#2563eb", flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>

          {/* Divider + add button */}
          <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <a
              href="/onboarding"
              className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[#f4f4f5]"
              style={{ color: "var(--on-dark-soft)" }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px dashed #d4d4d8" }}
              >
                <Plus style={{ width: 12, height: 12, color: "var(--gray-muted)" }} />
              </div>
              <span className="text-sm">Добавить филиал</span>
            </a>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center w-full rounded-md transition-colors hover:bg-[#f0f0f1]"
        style={{
          height: 48,
          paddingLeft: 8,
          paddingRight: 8,
          gap: 8,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center text-white font-semibold"
          style={{
            width: 32,
            height: 32,
            background: "#2563eb",
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {clubName.charAt(0).toUpperCase()}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 overflow-hidden text-left">
              <p
                className="font-medium truncate"
                style={{ fontSize: 14, color: "var(--on-dark-soft)", letterSpacing: "-0.084px", lineHeight: 1 }}
              >
                {clubName}
              </p>
              <p
                className="font-normal truncate"
                style={{ fontSize: 12, color: "var(--gray-muted)", lineHeight: 1, marginTop: 3 }}
              >
                Выбор филиала
              </p>
            </div>
            <ChevronsUpDown style={{ width: 14, height: 14, color: "var(--gray-muted)", flexShrink: 0 }} />
          </>
        )}
      </button>
    </div>
  )
}
