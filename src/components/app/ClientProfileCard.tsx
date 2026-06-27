"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Snowflake, Trash2, X } from "lucide-react"
import type { ClientProfile } from "@/lib/client-profile"
import type { ClientStatus } from "@/lib/clients"
import { deleteClientAction, toggleFreezeAction } from "@/app/(app)/clients/actions"

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active:  { label: "Активный",       bg: "#dcfce7", color: "#16a34a" },
  expired: { label: "Истёк",          bg: "#fee2e2", color: "#dc2626" },
  frozen:  { label: "Заморожен",      bg: "#dbeafe", color: "#2563eb" },
  none:    { label: "Без абонемента", bg: "var(--card-2)", color: "var(--on-dark-soft)" },
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function Field({ label, value, link }: { label: string; value: string | null; link?: string }) {
  return (
    <div className="py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--gray-muted)" }}>{label}</p>
      {link && value ? (
        <a href={link} className="text-sm font-medium hover:underline" style={{ color: "#2563eb" }}>{value}</a>
      ) : (
        <p className="text-sm font-medium" style={{ color: "var(--on-dark-soft)" }}>{value ?? "—"}</p>
      )}
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmDanger,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 transition-colors"
          style={{ color: "var(--gray-muted)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--on-dark)" }}>{title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{description}</p>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors hover:bg-zinc-50"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
          >
            Нет
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: confirmDanger ? "#dc2626" : "var(--on-dark)" }}
          >
            {loading ? "..." : "Да"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClientProfileCard({ client }: { client: ClientProfile }) {
  const sm = statusMeta[client.status]
  const comment = client.notes && client.notes !== "[demo]" ? client.notes : ""
  const isFrozen = client.status === "frozen"
  const canFreeze = client.status === "active" || client.status === "frozen"

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<"delete" | "freeze" | null>(null)

  function handleDelete() {
    startTransition(async () => {
      await deleteClientAction(client.id)
      router.push("/clients")
    })
  }

  function handleFreeze() {
    startTransition(async () => {
      await toggleFreezeAction(client.id, client.status)
      setDialog(null)
      router.refresh()
    })
  }

  return (
    <>
      <div
        className="rounded-lg p-6 flex flex-col relative overflow-hidden transition-all duration-300"
        style={{
          background: "var(--card)",
          border: isFrozen ? "1.5px solid #93c5fd" : "1px solid var(--border)",
        }}
      >
        {/* Эффект заморозки — ледяной оверлей */}
        {isFrozen && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(135deg, rgba(219,234,254,0.35) 0%, rgba(191,219,254,0.15) 100%)",
              }}
            />
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full pointer-events-none"
              style={{ background: "#dbeafe", border: "1px solid #93c5fd" }}>
              <Snowflake className="w-3 h-3" style={{ color: "#2563eb" }} />
              <span className="text-xs font-medium" style={{ color: "#2563eb" }}>Заморожен</span>
            </div>
          </>
        )}

        {/* Аватар + имя в ряд */}
        <div className="flex items-center gap-4 mb-4 relative">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white flex-shrink-0 relative"
            style={{ background: isFrozen ? "#93c5fd" : "#60a5fa" }}
          >
            {initials(client.name)}
            {isFrozen && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "#2563eb" }}>
                <Snowflake className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold tracking-[-0.12px] truncate" style={{ color: "var(--on-dark)" }}>
                {client.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{ background: sm.bg, color: sm.color }}>
                {sm.label}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>Баланс: 0 сум</p>
          </div>
        </div>

        {/* Поля */}
        <div className="flex flex-col relative">
          <Field label="Телефон" value={client.phone} link={client.phone ? `tel:${client.phone}` : undefined} />
          <Field label="Телеграм" value={client.telegram} />
          <Field label="Источник" value={null} />
          <Field label="Цель" value={null} />
          <Field label="Тренер" value={null} />
          <Field label="Дата регистрации" value={fmtDate(client.createdAt)} />
          <Field label="Пол" value={null} />
        </div>

        {/* Комментарий */}
        <div className="py-3 relative" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--gray-muted)" }}>Комментарий</p>
          <textarea
            readOnly
            defaultValue={comment}
            placeholder="Нет комментария"
            rows={3}
            className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
          />
        </div>

        {/* Действия */}
        <div className="flex flex-col gap-2 mt-2 relative">
          <button
            className="h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--on-dark)" }}
          >
            Добавить оплату
          </button>

          {canFreeze && (
            <button
              onClick={() => setDialog("freeze")}
              className="h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{
                background: isFrozen ? "#eff6ff" : "var(--card)",
                border: isFrozen ? "1px solid #93c5fd" : "1px solid var(--border)",
                color: isFrozen ? "#2563eb" : "var(--on-dark)",
              }}
            >
              <Snowflake className="w-4 h-4" />
              {isFrozen ? "Разморозить" : "Заморозить"}
            </button>
          )}

          <button
            onClick={() => setDialog("delete")}
            className="h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-red-50"
            style={{ background: "var(--card)", border: "1px solid #fecaca", color: "#dc2626" }}
          >
            <Trash2 className="w-4 h-4" />
            Удалить клиента
          </button>
        </div>
      </div>

      {/* Диалог удаления */}
      <ConfirmDialog
        open={dialog === "delete"}
        title="Удалить клиента?"
        description={`Вы действительно хотите удалить «${client.name}»? Это действие необратимо — все данные клиента будут удалены.`}
        confirmLabel="Удалить"
        confirmDanger
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
        loading={pending}
      />

      {/* Диалог заморозки */}
      <ConfirmDialog
        open={dialog === "freeze"}
        title={isFrozen ? "Разморозить клиента?" : "Заморозить клиента?"}
        description={
          isFrozen
            ? `Абонемент «${client.name}» будет восстановлен, клиент снова станет активным.`
            : `Абонемент «${client.name}» будет заморожен. Вы сможете разморозить его в любой момент.`
        }
        confirmLabel={isFrozen ? "Разморозить" : "Заморозить"}
        onConfirm={handleFreeze}
        onCancel={() => setDialog(null)}
        loading={pending}
      />
    </>
  )
}
