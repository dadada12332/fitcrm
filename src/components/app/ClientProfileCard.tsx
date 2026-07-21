"use client"

import { useState, useTransition } from "react"
import { toast } from "@/lib/use-action"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Snowflake, Trash2, X } from "lucide-react"
import type { ClientProfile } from "@/lib/client-profile"
import type { ClientStatus } from "@/lib/clients"
import { deleteClientAction, toggleFreezeAction } from "@/app/(app)/clients/actions"
import { NewPaymentModal } from "./NewPaymentModal"
import { RenewSubscriptionButton } from "./RenewSubscriptionButton"

type Membership = { id: string; name: string; price: number }

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active:  { label: "Активный",       bg: "rgba(22,163,74,0.14)", color: "#16a34a" },
  expired: { label: "Истёк",          bg: "rgba(220,38,38,0.14)", color: "#dc2626" },
  frozen:  { label: "Заморожен",      bg: "rgba(37,99,235,0.14)", color: "#2563eb" },
  none:    { label: "Без абонемента", bg: "var(--card-2)", color: "var(--on-dark-soft)" },
}

const genderLabel: Record<string, string> = { male: "Мужской", female: "Женский" }

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function fmtMoney(v: number) {
  return `${Math.round(v).toLocaleString("ru-RU")} сум`
}

function Field({ label, value, link }: { label: string; value: string | null; link?: string }) {
  return (
    <div className="py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--gray-muted)" }}>{label}</p>
      {link && value ? (
        <a href={link} className="break-words text-sm font-medium hover:underline" style={{ color: "#2563eb" }}>{value}</a>
      ) : (
        <p className="break-words text-sm font-medium" style={{ color: "var(--on-dark-soft)" }}>{value ?? "—"}</p>
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
  error,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error?: string | null
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-lg p-6 flex flex-col gap-4"
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

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }}>
            {error}
          </p>
        )}

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
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClientProfileCard({ client, memberships }: { client: ClientProfile; memberships: Membership[] }) {
  const [status, setStatus] = useState<ClientStatus>(client.status)
  const sm = statusMeta[status]
  const comment = client.notes && client.notes !== "[demo]" ? client.notes : ""
  const importedFields = Object.entries(client.importData?.extraFields ?? {})
  const isFrozen = status === "frozen"
  const canFreeze = status === "active" || status === "frozen"

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<"delete" | "freeze" | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const telegramLabel = client.telegram
    ? [client.telegram.name, client.telegram.username ? `@${client.telegram.username}` : null].filter(Boolean).join(" · ") || "Привязан"
    : null

  function handleDelete() {
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteClientAction(client.id)
      if (res?.error) { setDeleteError(res.error); toast.error(res.error); return }
      toast.success("Клиент удалён")
      router.push("/clients")
    })
  }

  function handleFreeze() {
    const prev = status
    const next: ClientStatus = status === "frozen" ? "active" : "frozen"
    setStatus(next)          // оптимистично — статус меняется мгновенно
    setDialog(null)
    startTransition(async () => {
      const res = await toggleFreezeAction(client.id, prev)
      if (res?.error) { setStatus(prev); toast.error(res.error); return }  // откат при ошибке
      toast.success(next === "frozen" ? "Клиент заморожен" : "Клиент разморожен")
      router.refresh()       // фоновая синхронизация
    })
  }

  return (
    <>
      <div
        className="relative flex flex-col overflow-hidden rounded-lg p-4 transition-all duration-300 sm:p-6"
        style={{
          background: "var(--card)",
          border: isFrozen ? "1.5px solid #93c5fd" : "1px solid var(--border)",
        }}
      >
        {isFrozen && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(219,234,254,0.35) 0%, rgba(191,219,254,0.15) 100%)",
            }}
          />
        )}

        {/* Аватар + имя */}
        <div className="relative mb-4 flex items-center gap-3 sm:gap-4">
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
            <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
              ID: {client.id.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Финансы */}
        <div className="grid grid-cols-2 gap-2 relative mb-1">
          <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-0.5" style={{ color: "var(--gray-muted)" }}>Баланс</p>
            <p className="break-words text-sm font-semibold leading-tight tabular-nums sm:text-base" style={{ color: client.balance > 0 ? "#16a34a" : "var(--on-dark)" }}>
              {fmtMoney(client.balance)}
            </p>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: client.debt > 0 ? "rgba(220,38,38,0.06)" : "var(--card-2)", border: `1px solid ${client.debt > 0 ? "rgba(220,38,38,0.25)" : "var(--border)"}` }}>
            <p className="text-xs mb-0.5" style={{ color: "var(--gray-muted)" }}>Долг</p>
            <p className="break-words text-sm font-semibold leading-tight tabular-nums sm:text-base" style={{ color: client.debt > 0 ? "#dc2626" : "var(--on-dark)" }}>
              {fmtMoney(client.debt)}
            </p>
          </div>
        </div>

        {/* Поля */}
        <div className="flex flex-col relative">
          <Field label="Телефон" value={client.phone} link={client.phone ? `tel:${client.phone}` : undefined} />
          <Field
            label="Telegram-профиль"
            value={telegramLabel}
            link={client.telegram?.username ? `https://t.me/${client.telegram.username}` : undefined}
          />
          <Field label="Telegram ID" value={client.telegram?.id ?? null} />
          <Field label="Email" value={client.email} link={client.email ? `mailto:${client.email}` : undefined} />
          <Field label="Дата рождения" value={fmtDate(client.birthDate)} />
          <Field label="Пол" value={client.gender ? (genderLabel[client.gender] ?? client.gender) : null} />
          <Field label="Тренер" value={client.trainer} />
          <Field label="Источник" value={client.source} />
          <Field label="Дата регистрации" value={fmtDate(client.createdAt)} />
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

        {importedFields.length > 0 && (
          <section className="relative border-t border-border py-3" aria-labelledby="imported-client-data">
            <div className="mb-3 flex items-start gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileSpreadsheet className="size-4" />
              </div>
              <div className="min-w-0">
                <p id="imported-client-data" className="text-sm font-semibold text-foreground">Данные из прежней CRM</p>
                <p className="truncate text-xs text-muted-foreground">
                  {client.importData?.sourceFile ?? "Импортированный файл"}
                  {client.importData?.importedAt ? ` · ${fmtDate(client.importData.importedAt)}` : ""}
                </p>
              </div>
            </div>
            <dl className="divide-y divide-border overflow-hidden rounded-md border border-border bg-muted/30">
              {importedFields.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-3">
                  <dt className="break-words text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Действия */}
        <div className="flex flex-col gap-2 mt-2 relative">
          <button
            onClick={() => setPaymentOpen(true)}
            className="h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--on-dark)" }}
          >
            Добавить оплату
          </button>

          <RenewSubscriptionButton clientId={client.id} clientName={client.name} subscription={client.subscription} memberships={memberships} />

          {canFreeze && (
            <button
              onClick={() => setDialog("freeze")}
              className="h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{
                background: isFrozen ? "rgba(37,99,235,0.1)" : "var(--card)",
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
            style={{ background: "var(--card)", border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626" }}
          >
            <Trash2 className="w-4 h-4" />
            Удалить клиента
          </button>
        </div>
      </div>

      {paymentOpen && (
        <NewPaymentModal
          memberships={memberships}
          fixedClient={{ id: client.id, name: client.name, phone: client.phone }}
          onClose={() => {
            setPaymentOpen(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === "delete"}
        title="Удалить клиента?"
        description={`Вы действительно хотите удалить «${client.name}»? Абонементы и посещения будут удалены, история оплат сохранится (без привязки к клиенту).`}
        confirmLabel="Удалить"
        confirmDanger
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => { setDialog(null); setDeleteError(null) }}
        loading={pending}
      />

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
